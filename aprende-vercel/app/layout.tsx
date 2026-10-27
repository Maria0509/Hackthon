import type { Metadata } from 'next';
export const metadata:Metadata={title:'Aprende+ | O teu próximo passo',description:'Planos personalizados de aprendizagem com Gemini e carga horária validada.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt"><head><link rel="stylesheet" href="/style.css" /></head><body>{children}</body></html>;}
