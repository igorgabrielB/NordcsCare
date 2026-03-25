export default function Footer() {
  return (
    <footer className="layout-footer">
      <div className="footer-left">
        <img src="/imagens/logo-escrita.png" alt="NordcsCare" className="footer-logo-img" />
        <span className="footer-copy">&copy; {new Date().getFullYear()} Nordcs. Todos os direitos reservados.</span>
      </div>
      <div className="footer-right">
        <span className="footer-version">v1.5</span>
      </div>
    </footer>
  )
}
