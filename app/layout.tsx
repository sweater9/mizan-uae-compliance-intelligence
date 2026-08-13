import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"UAE Compliance Intelligence Demo",description:"Personalised UAE SME compliance intelligence demonstration."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
