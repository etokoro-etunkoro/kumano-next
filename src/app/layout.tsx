import "./globals.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
return (
<html lang="ja">
<body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
<header style={{ padding: '12px 16px', borderBottom: '1px solid #ddd' }}>
<b>kumano-room-assignment-system</b>
</header>
<main className="container" style={{padding: "16px"}}>{children}</main>
</body>
</html>
);
}