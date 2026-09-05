import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Mizan UAE Regulatory Intelligence",description:"Free evidence-led UAE regulatory search and compliance intelligence.",other:{"codex-preview":"development"}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
