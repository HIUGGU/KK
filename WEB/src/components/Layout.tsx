import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: 'M3 3h7v8H3V3zm11 0h7v5h-7V3zM3 14h7v7H3v-7zm11-3h7v10h-7V11z' },
    ],
  },
  {
    title: 'Employees',
    items: [
      { to: '/employees', label: 'Employees', icon: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.87M16 2.13a4 4 0 0 1 0 7.75' },
      { to: '/attendance', label: 'Attendance', icon: 'M3 5h18v16H3V5zm0 5h18M8 2v4m8-4v4m-6 9l2 2 4-4' },
      { to: '/salary', label: 'Salary', icon: 'M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
      { to: '/salary-changes', label: 'Salary Changes', icon: 'M3 17l6-6 4 4 8-8M15 7h6v6' },
      { to: '/advances', label: 'Advances', icon: 'M21 12H3m0 0l6-6m-6 6l6 6M17 3h4v18h-4' },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/products', label: 'Products', icon: 'M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7.3L12 12l8.7-4.7M12 12v10' },
      { to: '/clients', label: 'Clients', icon: 'M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 11h-6' },
      { to: '/orders', label: 'Orders', icon: 'M9 2h6l1 3H8l1-3zM4 5h16l-1.5 16h-13L4 5zm5 5v7m6-7v7' },
      { to: '/payments', label: 'Payments', icon: 'M2 6h20v12H2V6zm0 4h20M6 15h4' },
      { to: '/settlements', label: 'Settlements', icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
      { to: '/bank-accounts', label: 'Bank Accounts', icon: 'M3 10l9-6 9 6M5 10v10h14V10M3 20h18M9 20v-6h6v6' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { to: '/raw-materials', label: 'Raw Materials', icon: 'M3 7l9-4 9 4v10l-9 4-9-4V7zm0 0l9 4 9-4M12 11v10' },
      { to: '/cutting', label: 'Cutting', icon: 'M6 3l12 12M18 3L6 15M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm12 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' },
      { to: '/plasma', label: 'Plasma', icon: 'M13 2L3 14h8l-1 8 10-12h-8l1-8z' },
      { to: '/tinker', label: 'Tinker', icon: 'M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 1 5.4-5.4l-2.5 2.5' },
      { to: '/buffing', label: 'Buffing', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z' },
      { to: '/vendor-payments', label: 'Vendor Payments', icon: 'M3 6h18v12H3V6zm9 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z' },
      { to: '/vendors', label: 'Vendors', icon: 'M3 9l1.5-5h15L21 9M3 9h18v11H3V9zm6 11v-7h6v7' },
      { to: '/material-masters', label: 'Material Masters', icon: 'M4 4h16v5H4V4zm0 7h7v9H4v-9zm9 0h7v9h-7v-9z' },
    ],
  },
];

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">BM</span>
          <div className="sidebar-title">
            <h2>Business</h2>
            <span>Management</span>
          </div>
        </div>
        <div className="nav-scroll">
          {NAV_SECTIONS.map((section) => (
            <div className="nav-group" key={section.title}>
              <span className="nav-section-title">{section.title}</span>
              <ul className="nav-menu">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={location.pathname === item.to ? 'active' : ''}
                    >
                      <svg
                        className="nav-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d={item.icon} />
                      </svg>
                      <span className="nav-label">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
