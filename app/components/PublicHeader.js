import Image from "next/image";
import Link from "next/link";

export default function PublicHeader({ active }) {
  return <header className="bvi-public-header"><div className="bvi-public-header-inner">
    <Link href="/" className="bvi-brand" aria-label="BVI Tornei, home"><Image src="/logo.png" alt="BVI" width={36} height={36} /><span>BVI <span>/</span> Tornei</span></Link>
    <nav aria-label="Navigazione principale" className="bvi-public-nav">
      {[{ label: "Tornei", href: "/#tornei" }, { label: "Tour", href: "/tour" }].map((item) => <Link key={item.label} href={item.href} aria-current={active === item.label ? "page" : undefined}>{item.label}</Link>)}
      <Link href="/atleta" className="bvi-athlete-link">Area atleta ↗</Link>
    </nav>
  </div></header>;
}
