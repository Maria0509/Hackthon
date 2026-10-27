import Script from 'next/script';
import { redirect } from 'next/navigation';
import { requireSession } from '../lib/auth';
import { interfaceMarkup } from '../lib/interface';
export const dynamic='force-dynamic';
export default async function Page(){try{await requireSession(false);}catch{redirect('/login');}return <><div dangerouslySetInnerHTML={{__html:interfaceMarkup}} /><Script src="/app.js" strategy="afterInteractive" /><Script src="/account.js" strategy="afterInteractive" /></>;}
