import fs from "fs"
import path from "path"
import {PixivIllust} from "pixiv.ts"

export default class Functions {
    public static arrayIncludes = (str: string, arr: string[]) => {
        for (let i = 0; i < arr.length; i++) {
            if (str.includes(arr[i])) return true
        }
        return false
    }

    public static arrayRemove = <T>(arr: T[], val: T) => {
        return arr.filter((item) => item !== val)
    }

    public static timeout = async (ms: number) => {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    public static removeDirectory = (dir: string) => {
        if (!fs.existsSync(dir)) return
        fs.readdirSync(dir).forEach((file: string) => {
            const current = path.join(dir, file)
            if (fs.lstatSync(current).isDirectory()) {
                Functions.removeDirectory(current)
            } else {
                fs.unlinkSync(current)
            }
        })
        try {
            fs.rmdirSync(dir)
        } catch (e) {
            console.log(e)
        }
    }

    public static decodeEntities(encodedString: string) {
        const regex = /&(nbsp|amp|quot|lt|gt);/g
        const translate = {
            nbsp:" ",
            amp : "&",
            quot: "\"",
            lt  : "<",
            gt  : ">"
        } as any
        return encodedString.replace(regex, function(match, entity) {
            return translate[entity]
        }).replace(/&#(\d+);/gi, function(match, numStr) {
            const num = parseInt(numStr, 10)
            return String.fromCharCode(num)
        })
    }

    public static logoDrag = (enable?: boolean) => {
        if (enable) {
            // @ts-expect-error
            document.querySelector(".logo-bar-drag")?.style["-webkit-app-region"] = "drag"
        } else {
            // @ts-expect-error
            document.querySelector(".logo-bar-drag")?.style["-webkit-app-region"] = "no-drag"
        }
    }

    public static prettyFormatDate = (date: string) => {
        const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
        const arr = date.substring(0, 10).split("-")
        const year = arr[0]
        const month = Number(arr[1])
        const day = Number(arr[2])
        return `${months[month - 1]} ${day}, ${year}`
    }

    public static clean = (text: string) => {
        return text?.replace(/[^a-z0-9_-\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uff9f\u4e00-\u9faf\u3400-\u4dbf【】()\[\]&!#. ]/gi, "").replace(/~/g, "").replace(/ +/g, " ") ?? ""
      }

    public static parseTemplate = (illust: PixivIllust, template: string, pageNum?: number) => {
        if (pageNum != undefined) {
            template = template.replace(/(\*)/g, "")
        } else {
            template = template.replace(/(\*).*?(\*)/g, "")
        }
        return template
        .replace(/{title}/gi, Functions.clean(illust.title))
        .replace(/{id}/gi, String(illust.id))
        .replace(/{artist}/gi, Functions.clean(illust.user.name))
        .replace(/{user}/gi, illust.user.account)
        .replace(/{user id}/gi, String(illust.user.id))
        .replace(/{page}/gi, String(pageNum))
        .replace(/{date}/gi, illust.create_date.substring(0, 10))
        .replace(/{width}/gi, String(illust.width))
        .replace(/{height}/gi, String(illust.height))
    }
}
