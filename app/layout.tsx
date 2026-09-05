import type {Metadata} from "next";import "./globals.css";
export const metadata:Metadata={title:"Mizan | UAE Compliance Intelligence",description:"Mizan compliance planning with clearly labelled sample data and general information."};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
