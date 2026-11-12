import './globals.css';
export const viewport={width:'device-width',initialScale:1,themeColor:'#0d2344'};
export const metadata={
  title:'IOB | Daily Performance',
  description:'Dindigul regional daily reporting and review',
  icons:{icon:'/logo.svg'},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
