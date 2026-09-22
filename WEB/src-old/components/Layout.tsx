import { Link, useLocation } from 'react-router-dom';
import './Layout.css';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>Employee Management</h2>
        </div>
        <ul className="nav-menu">
          <li>
            <Link
              to="/"
              className={location.pathname === '/' ? 'active' : ''}
            >
              Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/employees"
              className={location.pathname === '/employees' ? 'active' : ''}
            >
              Employees
            </Link>
          </li>
          <li>
            <Link
              to="/attendance"
              className={location.pathname === '/attendance' ? 'active' : ''}
            >
              Attendance
            </Link>
          </li>
          <li>
            <Link
              to="/salary"
              className={location.pathname === '/salary' ? 'active' : ''}
            >
              Salary
            </Link>
          </li>
        </ul>
      </nav>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

