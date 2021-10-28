import {app, BrowserWindow, dialog, globalShortcut, ipcMain, shell, session} from "electron"
import {autoUpdater} from "electron-updater"
import Store from "electron-store"
import path from "path"
import process from "process"
import "./dev-app-update.yml"
import pack from "./package.json"
import Pixiv, {PixivIllust} from "pixiv.ts"
import unzip from "unzipper"
import functions from "./structures/functions"
import imageSize from "image-size"
import axios from "axios"
import fs from "fs"
require('@electron/remote/main').initialize()

process.setMaxListeners(0)
let window: Electron.BrowserWindow | null
let website: Electron.BrowserWindow | null
autoUpdater.autoDownload = false
const store = new Store()

const active: Array<{id: number, dest: string, frameFolder?: string, action: null | "kill"}> = []

ipcMain.handle("translate-title", async (event, title) => {
  const pixiv = await Pixiv.refreshLogin("c-SC58UMg144msd2ed2vNAkMnJAVKPPlik-0HkOPoAw")
  return pixiv.util.translateTitle(title)
})

ipcMain.handle("download-url", (event, url) => {
  if (window?.isMinimized()) window?.restore()
  window?.focus()
  window?.webContents.send("download-url", url)
})

const openWebsite = async () => {
  if (!website) {
    website = new BrowserWindow({width: 900, height: 650, minWidth: 790, minHeight: 550, frame: false, backgroundColor: "#ffffff", center: false, webPreferences: {nodeIntegration: true, webviewTag: true, contextIsolation: false}})
    await website.loadFile(path.join(__dirname, "website.html"))
    require("@electron/remote/main").enable(website.webContents)
    website?.on("closed", () => {
      website = null
    })
  } else {
    if (website.isMinimized()) website.restore()
    website.focus()
  }
}

ipcMain.handle("open-url", async (event, url: string) => {
  await openWebsite()
  website?.webContents.send("open-url", url)
})

ipcMain.handle("open-website", async () => {
  if (website) {
    website.close()
  } else {
    await openWebsite()
  }
})

ipcMain.handle("advanced-settings", () => {
  window?.webContents.send("close-all-dialogs", "settings")
  window?.webContents.send("show-settings-dialog")
})

ipcMain.handle("get-dimensions", async (event, url: string) => {
  const arrayBuffer = await axios.get(url, {responseType: "arraybuffer", headers: {Referer: "https://www.pixiv.net/"}}).then((r) => r.data)
  const dimensions = imageSize(arrayBuffer)
  return {width: dimensions.width, height: dimensions.height}
})

ipcMain.handle("preview", (event, image: string) => {
  window?.webContents.send("preview", image)
})

ipcMain.handle("update-color", (event, color: string) => {
  window?.webContents.send("update-color", color)
})

ipcMain.handle("trigger-paste", () => {
  window?.webContents.send("trigger-paste")
})

ipcMain.handle("delete-all", () => {
  window?.webContents.send("delete-all")
})

ipcMain.handle("clear-all", () => {
  window?.webContents.send("clear-all")
})

ipcMain.handle("delete-download", async (event, id: number) => {
  let dest = ""
  let frameFolder = ""
  let index = active.findIndex((a) => a.id === id)
  if (index !== -1) {
    dest = active[index].dest
    frameFolder = active[index].frameFolder ?? ""
    active[index].action = "kill"
  }
  if (dest || frameFolder) {
    let error = true
    while ((frameFolder ? fs.existsSync(dest) && fs.existsSync(frameFolder) : fs.existsSync(dest)) && error) {
      try {
        if (frameFolder) functions.removeDirectory(frameFolder)
        if (fs.statSync(dest).isDirectory()) {
          functions.removeDirectory(dest)
        } else {
          fs.unlinkSync(dest)
        }
        error = false
      } catch {
        // ignore
      }
      await functions.timeout(1000)
    }
    return true
  } 
  return false
})

ipcMain.handle("download-error", async (event, info) => {
  window?.webContents.send("download-error", info)
})

ipcMain.handle("download", async (event, info: {id: number, illust: PixivIllust, dest: string, format: string, speed: number, reverse: boolean, template: string, translateTitles: boolean}) => {
  const pixiv = await Pixiv.refreshLogin("c-SC58UMg144msd2ed2vNAkMnJAVKPPlik-0HkOPoAw")
  const {id, illust, dest, format, speed, reverse, template, translateTitles} = info
  window?.webContents.send("download-started", {id, illust})
  const folder = path.dirname(dest)
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, {recursive: true})
  if (illust.type === "ugoira") {
    // Download Ugoira
    const metadata = await pixiv.ugoira.get(illust.id).then((r) => r.ugoira_metadata)
    const zipUrl = metadata.zip_urls.medium
    if (format === "gif") {
      const frameFolder = path.join(folder, illust.id.toString())
      if (!fs.existsSync(frameFolder)) fs.mkdirSync(frameFolder, {recursive: true})
      active.push({id, dest, frameFolder, action: null})
      const writeStream = await axios.get(zipUrl, {responseType: "stream", headers: {Referer: "https://www.pixiv.net/"}}).then((r) => r.data.pipe(unzip.Extract({path: frameFolder})))
      await pixiv.util.awaitStream(writeStream)
      const frames = fs.readdirSync(frameFolder)
      const constraint = speed > 1 ? frames.length / speed : frames.length
      let step = Math.ceil(frames.length / constraint)
      let frameArray: string[] = []
      let delayArray: number[] = []
      for (let i = 0; i < frames.length; i += step) {
          if (frames[i].slice(-5) === ".webp") continue
          if (!metadata.frames[i]) break
          frameArray.push(`${frameFolder}/${frames[i]}`)
          delayArray.push(metadata.frames[i].delay)
      }
      if (speed < 1) delayArray = delayArray.map((n) => n / speed)
      if (reverse) {
          frameArray = frameArray.reverse()
          delayArray = delayArray.reverse()
      }
      await pixiv.util.encodeGif(frameArray, delayArray, dest)
      functions.removeDirectory(frameFolder)
    } else if (format === "zip") {
      active.push({id, dest, action: null})
      const arrayBuffer = await axios.get(zipUrl, {responseType: "arraybuffer", headers: {Referer: "https://www.pixiv.net/"}}).then((r) => r.data)
      fs.writeFileSync(dest, Buffer.from(arrayBuffer, "binary"))
    }
  } else if (illust.meta_pages.length) {
    // Download Manga
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, {recursive: true})
    active.push({id, dest, action: null})
    for (let i = 0; i < illust.meta_pages.length; i++) {
      const name = await functions.parseTemplate(illust, template, i, translateTitles)
      const image = illust.meta_pages[i].image_urls.large ? illust.meta_pages[i].image_urls.large : illust.meta_pages[i].image_urls.medium
      const pageDest = `${dest}/${name}.${format}`
      const arrayBuffer = await axios.get(image, {responseType: "arraybuffer", headers: {Referer: "https://www.pixiv.net/"}}).then((r) => r.data)
      fs.writeFileSync(pageDest, Buffer.from(arrayBuffer, "binary"))
    }
  } else {
    // Download Illust
    active.push({id, dest, action: null})
    const url = illust.image_urls.large ? illust.image_urls.large : illust.image_urls.medium
    const arrayBuffer = await axios.get(url, {responseType: "arraybuffer", headers: {Referer: "https://www.pixiv.net/"}}).then((r) => r.data)
    fs.writeFileSync(dest, Buffer.from(arrayBuffer, "binary"))
  }
  window?.webContents.send("download-ended", {id, output: dest})
})

ipcMain.handle("init-settings", () => {
  return store.get("settings", null)
})

ipcMain.handle("store-settings", (event, settings) => {
  const prev = store.get("settings", {}) as object
  store.set("settings", {...prev, ...settings})
})

ipcMain.handle("get-downloads-folder", async (event, location: string) => {
  if (store.has("downloads")) {
    return store.get("downloads")
  } else {
    const downloads = app.getPath("downloads")
    store.set("downloads", downloads)
    return downloads
  }
})

ipcMain.handle("open-location", async (event, location: string) => {
  if (!fs.existsSync(location)) return
  shell.showItemInFolder(path.normalize(location))
})

ipcMain.handle("select-directory", async (event, dir: string) => {
  if (!window) return
  if (dir === undefined) {
    const result = await dialog.showOpenDialog(window, {
      properties: ["openDirectory"]
    })
    dir = result.filePaths[0]
  }
  if (dir) {
    store.set("downloads", dir)
    return dir
  }
})

ipcMain.handle("get-state", () => {
  return store.get("state", {})
})

ipcMain.handle("save-state", (event, newState: any) => {
  let state = store.get("state", {}) as object
  state = {...state, ...newState}
  store.set("state", state)
})

ipcMain.handle("get-theme", () => {
  return store.get("theme", "light")
})

ipcMain.handle("save-theme", (event, theme: string) => {
  store.set("theme", theme)
})

ipcMain.handle("install-update", async (event) => {
  await autoUpdater.downloadUpdate()
  autoUpdater.quitAndInstall()
})

ipcMain.handle("check-for-updates", async (event, startup: boolean) => {
  window?.webContents.send("close-all-dialogs", "version")
  const update = await autoUpdater.checkForUpdates()
  const newVersion = update.updateInfo.version
  if (pack.version === newVersion) {
    if (!startup) window?.webContents.send("show-version-dialog", null)
  } else {
    window?.webContents.send("show-version-dialog", newVersion)
  }
})

const singleLock = app.requestSingleInstanceLock()

if (!singleLock) {
  app.quit()
} else {
  app.on("second-instance", (event, argv) => {
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })

  app.on("ready", () => {
    window = new BrowserWindow({width: 900, height: 650, minWidth: 720, minHeight: 450, frame: false, backgroundColor: "#656ac2", center: true, webPreferences: {nodeIntegration: true, contextIsolation: false, webSecurity: false}})
    window.loadFile(path.join(__dirname, "index.html"))
    window.removeMenu()
    require("@electron/remote/main").enable(window.webContents)
    window.on("close", () => {
      website?.close()
    })
    window.on("closed", () => {
      window = null
    })
    if (process.env.DEVELOPMENT === "true") {
      globalShortcut.register("Control+Shift+I", () => {
        window?.webContents.toggleDevTools()
        website?.webContents.toggleDevTools()
      })
    }
    session.defaultSession.webRequest.onBeforeSendHeaders({urls: ["https://*.pixiv.net/*", "https://*.pximg.net/*"]}, (details, callback) => {
      details.requestHeaders["Referer"] = "https://www.pixiv.net/"
      callback({requestHeaders: details.requestHeaders})
    })
    session.defaultSession.webRequest.onCompleted({urls: ["https://app-api.pixiv.net/*"]}, (details) => {
      console.log(details.url)
    })
  })
}
