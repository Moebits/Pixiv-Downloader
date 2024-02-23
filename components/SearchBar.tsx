import {ipcRenderer, clipboard} from "electron"
import React, {useState, useEffect, useRef, useContext} from "react"
import searchButton from "../assets/icons/searchButton.png"
import ErrorMessage from "./ErrorMessage"
import searchButtonHover from "../assets/icons/searchButton-hover.png"
import {DirectoryContext, KindContext, FormatContext, TranslateContext, R18Context, ReverseContext, SpeedContext, TemplateContext, FolderMapContext, SortContext, TargetContext, IllustLimitContext, MangaLimitContext, UgoiraLimitContext, TranslateTitlesContext, RestrictContext, MoeContext, BookmarksContext} from "../renderer"
import Pixiv, {PixivIllust, PixivNovel} from "pixiv.ts"
import functions from "../structures/functions"
import "../styles/searchbar.less"

const SearchBar: React.FunctionComponent = (props) => {
    const {directory} = useContext(DirectoryContext)
    const {kind, setKind} = useContext(KindContext)
    const {format, setFormat} = useContext(FormatContext)
    const {translate} = useContext(TranslateContext)
    const {r18} = useContext(R18Context)
    const {speed} = useContext(SpeedContext)
    const {reverse} = useContext(ReverseContext)
    const {template} = useContext(TemplateContext)
    const {folderMap} = useContext(FolderMapContext)
    const {sort} = useContext(SortContext)
    const {target} = useContext(TargetContext)
    const {illustLimit} = useContext(IllustLimitContext)
    const {mangaLimit} = useContext(MangaLimitContext)
    const {ugoiraLimit} = useContext(UgoiraLimitContext)
    const {translateTitles} = useContext(TranslateTitlesContext)
    const {restrict} = useContext(RestrictContext)
    const {moe} = useContext(MoeContext)
    const {bookmarks} = useContext(BookmarksContext)
    const [id, setID] = useState(1)
    const [searchHover, setSearchHover] = useState(false)
    const searchBoxRef = useRef(null) as React.RefObject<HTMLInputElement>
    
    useEffect(() => {
        const triggerPaste = () => {
            const text = clipboard.readText()
            searchBoxRef.current!.value += text
        }
        ipcRenderer.on("trigger-paste", triggerPaste)
        return () => {
            ipcRenderer.removeListener("trigger-paste", triggerPaste)
        }
    }, [])

    useEffect(() => {
        const downloadURL = (event: any, url: string) => {
            if (url) download(url)
        }
        ipcRenderer.on("download-url", downloadURL)
        return () => {
            ipcRenderer.removeListener("download-url", downloadURL)
        }
    })

    const search = () => {
        let searchText = searchBoxRef.current?.value.trim() ?? ""
        searchBoxRef.current!.value = ""
        if (searchText) return download(searchText)
    }

    const updateFormat = (illust: PixivIllust | PixivNovel) => {
        if (illust.type === "ugoira") {
            if (format !== "gif" || format !== "zip") {
                setKind("ugoira")
                setFormat("gif")
                return "gif"
            }
        } else if (illust.type === "novel") {
            if (format !== "txt") {
                setKind("novel")
                setFormat("txt")
                return "txt"
            }
        } else {
            if (format !== "png" || format !== "jpg") {
                setKind("illust")
                setFormat("png")
                return "png"
            }
        }
    }

    const parseDest = async (illust: PixivIllust, directory: string, newFormat?: string) => {
        let dir = directory.replace(/\\+/g, "/")
        if (dir.endsWith("/")) dir = dir.slice(0, -1)
        const name = await functions.parseTemplate(illust, template, template.includes("*") ? undefined : 0, translateTitles)
        const tagFolder = await functions.parseFolderMap(illust, folderMap, translate)
        if (illust.meta_pages?.length) {
            return `${dir}/${tagFolder}${name}`
        } else {
            return `${dir}/${tagFolder}${name}.${newFormat ? newFormat : format}`
        }
    }

    const download = async (query: string) => {
        const refreshToken = await ipcRenderer.invoke("get-refresh-token")
        if (!refreshToken) return ipcRenderer.invoke("download-error", "login")
        const pixiv = await Pixiv.refreshLogin(refreshToken)
        let illustID = /\d{5,}/.test(query) ? Number(query.match(/\d{5,}/)?.[0]) : null
        if (!illustID) illustID = /\d{3,}/.test(query) ? Number(query.match(/\d{3,}/)?.[0]) : null
        console.log(illustID)
        if (illustID) {
            if (/users/.test(query)) {
                let illusts: PixivIllust[]
                if (kind === "novel" || /novels/.test(query)) {
                    illusts = await pixiv.user.novels({user_id: illustID, sort, restrict, bookmarks}) as any
                    if (pixiv.user.nextURL) illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.user.nextURL, novels: illusts as any})]
                } else {
                    illusts = /bookmarks/.test(query) ? await pixiv.user.bookmarksIllust({user_id: illustID, sort, restrict, bookmarks}) : await pixiv.user.illusts({user_id: illustID, sort, restrict, bookmarks})
                    if (pixiv.user.nextURL) illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.user.nextURL, illusts})]
                    illusts = illusts.filter((i) => i.type === kind).filter((i) => r18 ? i.x_restrict === 1 : i.x_restrict === 0)
                }
                let current = id
                let downloaded = false
                for (let i = 0; i < illusts.length; i++) {
                    const image = illusts[i].image_urls.large ? illusts[i].image_urls.large : illusts[i].image_urls.medium
                    const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                    illusts[i].width = dimensions.width
                    illusts[i].height = dimensions.height
                    const dest = await parseDest(illusts[i], directory)
                    ipcRenderer.invoke("download", {id: current, illust: illusts[i], dest, format, speed, reverse, template, translateTitles})
                    downloaded = true
                    current += 1
                    setID(prev => prev + 1)
                }
                if (!downloaded) return ipcRenderer.invoke("download-error", "search")
            } else {
                try {
                    const illust = /novel/.test(query) ? await pixiv.novel.get(illustID) as any : await pixiv.illust.get(illustID)
                    const newFormat = updateFormat(illust)
                    let current = id
                    const image = illust.image_urls.large ? illust.image_urls.large : illust.image_urls.medium
                    const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                    illust.width = dimensions.width
                    illust.height = dimensions.height
                    const dest = await parseDest(illust, directory, newFormat)
                    ipcRenderer.invoke("download", {id: current, illust, dest, format, speed, reverse, template, translateTitles})
                    setID(prev => prev + 1)
                } catch (e) {
                    console.log(e)
                    return ipcRenderer.invoke("download-error", "search")
                }
            }
        } else {
            let illusts: PixivIllust[]
            if (query === "day") {
                illusts = kind === "novel" ? await pixiv.search.novels({mode: r18 ? "day_r18" : "day", sort, bookmarks}) as any : await pixiv.search.illusts({mode: r18 ? "day_r18" : "day", sort, bookmarks})
            } else if (query === "week") {
                illusts = kind === "novel" ? await pixiv.search.novels({mode: r18 ? "week_r18" : "week", sort, bookmarks}) as any : await pixiv.search.illusts({mode: r18 ? "week_r18" : "week", sort, bookmarks})
            } else if (query === "month") {
                illusts = kind === "novel" ? await pixiv.search.novels({word: r18 ? "R-18" : "", mode: "month", sort, bookmarks}) as any : await pixiv.search.illusts({word: r18 ? "R-18" : "", mode: "month", sort, bookmarks})
            } else {
                if (kind === "ugoira") query += " うごイラ"
                if (r18) query += " R-18"
                illusts = kind === "novel" ? await pixiv.search.novels({word: query, en: translate, r18, type: kind, sort, search_target: target, restrict, bookmarks}) as any :
                await pixiv.search.illusts({word: query, en: translate, r18, type: kind, sort, search_target: target, restrict, bookmarks, moe})
            }
            let current = id
            let downloaded = false
            let limit = (kind === "illust" || kind === "novel") ? illustLimit : (kind === "manga" ? mangaLimit : ugoiraLimit)
            if (kind === "novel") {
                if (pixiv.search.nextURL && illusts.length < limit) illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.search.nextURL, novels: illusts as any}, limit)]
                illusts = illusts.slice(0, limit)
            } else {
                if (pixiv.search.nextURL && illusts.length < limit) illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.search.nextURL, illusts}, limit)]
                illusts = illusts.filter((i) => r18 ? i.x_restrict === 1 : i.x_restrict === 0).slice(0, limit)
            }
            for (let i = 0; i < illusts.length; i++) {
                const image = illusts[i].image_urls.large ? illusts[i].image_urls.large : illusts[i].image_urls.medium
                const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                illusts[i].width = dimensions.width
                illusts[i].height = dimensions.height
                const dest = await parseDest(illusts[i], directory)
                ipcRenderer.invoke("download", {id: current, illust: illusts[i], dest, format, speed, reverse, template, translateTitles})
                downloaded = true
                current += 1
                setID(prev => prev + 1)
            }
            if (!downloaded) return ipcRenderer.invoke("download-error", "search")
        }
    }

    const enterSearch = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === "Enter") search()
    }

    return (
        <section className="search-container">
            <ErrorMessage/>
            <div className="search-location">
                <div className="search-bar">
                    <input className="search-box" type="search" ref={searchBoxRef} spellCheck="false" placeholder="Pixiv link or query..." onKeyDown={enterSearch}/>
                    <button className="search-button" type="submit" id="submit" onClick={search}>
                        <img className="search-button-img" src={searchHover ? searchButtonHover : searchButton} onMouseEnter={() => setSearchHover(true)} onMouseLeave={() => setSearchHover(false)}/>
                    </button>
                </div>
            </div>
        </section>
    )
}

export default SearchBar