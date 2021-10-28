import React, {useEffect} from "react"
import ReactDom from "react-dom"
import BrowserTitleBar from "./components/BrowserTitleBar"
import "./website.less"

const App: React.FunctionComponent = () => {
    useEffect(() => {
        const webview = document.getElementById("webview") as any
        webview?.addEventListener("did-stop-loading", () => {
            webview?.setZoomFactor(0.8)
        }, false)
    }, [])

    return (
        <main className="app">
            <BrowserTitleBar/>
            <webview id="webview" src="https://www.pixiv.net/"></webview>
        </main>
    )
}

ReactDom.render(<App/>, document.getElementById("root"))