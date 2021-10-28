import {ipcRenderer} from "electron"
import React, {useState, useEffect} from "react"
import "../styles/errormessage.less"

const ErrorMessage: React.FunctionComponent = (props) => {
    const [error, setError] = useState(null as "search" | "login" | null)
    
    useEffect(() => {
        const downloadError = (event: any, err: any) => {
            setError(err)
        }
        ipcRenderer.on("download-error", downloadError)
        return () => {
            ipcRenderer.removeListener("download-error", downloadError)
        }
    }, [])

    const getMessage = () => {
        if (error === "search") {
            return "Could not find any illustrations."
        } else if (error === "login") {
            return "You must login through the browser first."
        }
    }

    if (error) {
        setTimeout(() => {setError(null)}, 3000)
        return (
            <section className="error-message">
                <p className="error-message-text">{getMessage()}</p>
            </section>
        )
    }
    return null
}

export default ErrorMessage