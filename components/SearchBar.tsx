import {ipcRenderer, clipboard} from "electron"
import React, {useState, useEffect, useRef, useContext} from "react"
import searchButton from "../assets/icons/searchButton.png"
import ErrorMessage from "./ErrorMessage"
import searchButtonHover from "../assets/icons/searchButton-hover.png"
import {DirectoryContext, KindContext, FormatContext, TranslateContext, R18Context, ReverseContext, SpeedContext, TemplateContext} from "../renderer"
import Pixiv, {PixivIllust} from "pixiv.ts"
import functions from "../structures/functions"
import "../styles/searchbar.less"

const SearchBar: React.FunctionComponent = (props) => {
    const {directory} = useContext(DirectoryContext)
    const {kind} = useContext(KindContext)
    const {format} = useContext(FormatContext)
    const {translate} = useContext(TranslateContext)
    const {r18} = useContext(R18Context)
    const {speed} = useContext(SpeedContext)
    const {reverse} = useContext(ReverseContext)
    const {template} = useContext(TemplateContext)
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

    const parseDest = (illust: PixivIllust, directory: string) => {
        let dir = directory.replace(/\\+/g, "/")
        if (dir.endsWith("/")) dir = dir.slice(0, -1)
        const name = functions.parseTemplate(illust, template)
        if (illust.meta_pages.length) {
            return `${dir}/${name}`
        } else {
            return `${dir}/${name}.${format}`
        }
    }

    const download = async (query: string) => {
        const pixiv = await Pixiv.refreshLogin("c-SC58UMg144msd2ed2vNAkMnJAVKPPlik-0HkOPoAw")
        const illustID = /\d{5,}/.test(query) ? Number(query.match(/\d{5,}/)?.[0]) : null
        if (illustID) {
            if (/users/.test(query)) {
                let illusts = await pixiv.user.illusts({user_id: illustID})
                illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.user.nextURL!, illusts})]
                illusts = illusts.filter((i) => i.type === kind).filter((i) => r18 ? i.x_restrict === 1 : i.x_restrict === 0)
                let current = id
                let downloaded = false
                for (let i = 0; i < illusts.length; i++) {
                    const image = illusts[i].image_urls.large ? illusts[i].image_urls.large : illusts[i].image_urls.medium
                    const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                    illusts[i].width = dimensions.width
                    illusts[i].height = dimensions.height
                    ipcRenderer.invoke("download", {id: current, illust: illusts[i], dest: parseDest(illusts[i], directory), format, speed, reverse, template})
                    downloaded = true
                    current += 1
                    setID(prev => prev + 1)
                }
                if (!downloaded) return ipcRenderer.invoke("download-error", "search")
            } else {
                try {
                    const illust = await pixiv.illust.get(illustID)
                    let current = id
                    const image = illust.image_urls.large ? illust.image_urls.large : illust.image_urls.medium
                    const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                    illust.width = dimensions.width
                    illust.height = dimensions.height
                    ipcRenderer.invoke("download", {id: current, illust, dest: parseDest(illust, directory), format, speed, reverse, template})
                    setID(prev => prev + 1)
                } catch {
                    return ipcRenderer.invoke("download-error", "search")
                }
            }
        } else {
            let illusts: PixivIllust[]
            if (query === "day") {
                illusts = await pixiv.search.illusts({mode: r18 ? "day_r18" : "day"})
            } else if (query === "week") {
                illusts = await pixiv.search.illusts({mode: r18 ? "week_r18" : "week"})
            } else if (query === "month") {
                illusts = await pixiv.search.illusts({word: r18 ? "R-18" : "", mode: "month"})
                
            } else {
                if (kind === "ugoira") query += " うごイラ"
                if (r18) query += " R-18"
                illusts = await pixiv.search.illusts({word: query, en: translate, r18, type: kind})
            }
            let current = id
            let downloaded = false
            illusts = [...illusts, ...await pixiv.util.multiCall({next_url: pixiv.search.nextURL!, illusts}, 100)]
            illusts = illusts.filter((i) => r18 ? i.x_restrict === 1 : i.x_restrict === 0)
            for (let i = 0; i < illusts.length; i++) {
                const image = illusts[i].image_urls.large ? illusts[i].image_urls.large : illusts[i].image_urls.medium
                const dimensions = await ipcRenderer.invoke("get-dimensions", image)
                illusts[i].width = dimensions.width
                illusts[i].height = dimensions.height
                ipcRenderer.invoke("download", {id: current, illust: illusts[i], dest: parseDest(illusts[i], directory), format, speed, reverse, template})
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