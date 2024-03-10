import Head from "next/head";
import "../styles/banner.scss";
import "../styles/navbar.scss";
import "../styles/chatSection.scss";
import "../styles/chatSidepanel.scss";
import "../styles/floatingButtonList.scss";
import "../styles/chatmessagesendform.scss";
import "../styles/chatmessage.scss";
import "../styles/progressBar.scss";
import "../styles/roomForm.scss";
import "../styles/file-share.css";


import { APP_NAME } from "../utils/Constants";
// Global styles
import "../styles/base.scss";

export default function App({ Component, pageProps }) {
    return (
        <>
            <Head>
                <title>{APP_NAME}</title>
            </Head>
            <Component {...pageProps} />
        </>
    );
}
