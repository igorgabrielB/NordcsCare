export default function Footer() {
  return (
    <footer className="layout-footer">
      <div className="footer-left">
        <div className="footer-brand">
          <span className="footer-logo">N</span>
          <span className="footer-name">NordcsCare</span>
        </div>
        <span className="footer-copy">&copy; {new Date().getFullYear()} Nordcs. Todos os direitos reservados.</span>
      </div>
      <div className="footer-right">
        <span className="footer-version">v1.4</span>
      </div>
    </footer>
  )
}
