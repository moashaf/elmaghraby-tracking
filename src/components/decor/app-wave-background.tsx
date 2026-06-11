export function AppWaveBackground() {
  return (
    <div aria-hidden className="app-wave-bg pointer-events-none print:hidden">
      <svg className="app-wave-bg__svg" preserveAspectRatio="none" viewBox="0 0 1440 320">
        <path
          d="M0,192L48,197.3C96,203,192,213,288,218.7C384,224,480,224,576,208C672,192,768,160,864,154.7C960,149,1056,171,1152,181.3C1248,192,1344,192,1392,192L1440,192L1440,320L0,320Z"
          fill="currentColor"
        />
      </svg>
      <svg className="app-wave-bg__corner" viewBox="0 0 120 120">
        <circle cx="100" cy="100" fill="none" r="80" stroke="currentColor" strokeWidth="1" />
        <circle cx="100" cy="100" fill="none" r="55" stroke="currentColor" strokeWidth="1" />
      </svg>
    </div>
  );
}
