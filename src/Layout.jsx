import { Outlet } from "react-router-dom";
import Sidebar from "./Components/Sidebar";

const Layout = () => {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <Outlet /> {/* This will render the current route's component */}
      </div>
    </div>
  );
};

export default Layout;
