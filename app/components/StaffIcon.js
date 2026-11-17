const paths = {
  dashboard: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  registrations: ["M8 4H5v17h14V4h-3", "M8 2h8v5H8z", "m8 13 2 2 5-5", "M8 18h8"],
  athletes: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M16 3a4 4 0 0 1 0 8", "M22 21v-2a4 4 0 0 0-3-3.87"],
  tournaments: ["M8 3h8v6a4 4 0 0 1-8 0z", "M8 5H4v2a4 4 0 0 0 4 4", "M16 5h4v2a4 4 0 0 1-4 4", "M12 13v5", "M8 21h8", "M9 18h6v3H9z"],
  tour: ["M4 19h16", "M5 15V9h4v6", "M10 15V4h4v11", "M15 15v-4h4v4"],
  management: ["M4 4h6v6H4z", "M4 14h6v6H4z", "M16 9h5v6h-5z", "M10 7h3v10h-3", "M13 12h3"],
  payments: ["M3 5h18v14H3z", "M3 9h18", "M7 15h3"],
  sponsors: ["m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  external: ["M14 3h7v7", "m10 14 11-11", "M21 14v6H3V3h7"],
  plus: ["M12 5v14", "M5 12h14"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  close: ["m6 6 12 12", "M18 6 6 18"],
  logout: ["M9 3H3v18h6", "M9 12h12", "m16 7 5 5-5 5"],
};

export default function StaffIcon({ name, className = "h-5 w-5" }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
    {(paths[name] || paths.dashboard).map((d, i) => <path key={i} d={d} />)}
    {name === "athletes" && <circle cx="9" cy="7" r="4" />}
  </svg>;
}
