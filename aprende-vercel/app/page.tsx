import Script from 'next/script';
import { interfaceMarkup } from '../lib/interface';
export default function Page(){return <><div dangerouslySetInnerHTML={{__html:interfaceMarkup}} /><Script src="/app.js" strategy="afterInteractive" /></>;}
