import './globals.css';
export const viewport={width:'device-width',initialScale:1,themeColor:'#0d2344'};
export const metadata={
  title:'IOB | Regional Performance & Operations Portal',
  description:'Dindigul Regional Office - Daily Performance, SMA Recovery & Low Balance Funding Portals',
  icons:{icon:'/logo.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
