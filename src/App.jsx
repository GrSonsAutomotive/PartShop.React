// App.jsx
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import PartsBrowse from "./components/PartsBrowse";
import About from "./components/About";
import Contact from "./components/Contact";
import AdminActions from "./components/AdminActions";
import AddItem from "./components/AddItem";
import Login from "./components/Login";
import ChangePassword from "./components/ChangePassword";
import SearchItem from "./components/SearchItem";
import AdminOrders from "./components/AdminOrders";
import AdminPartDetails from "./components/AdminPartDetails";
import CustomerPartDetails from "./components/CustomerPartDetails";
import { CartProvider } from "./components/CartContext";
import AdminRefunds from "./components/AdminRefunds";
import CustomerReturnRequest from "./components/CustomerReturnRequest";
import Home from "./components/Home";
import AdminDiscounts from "./components/AdminDiscounts";
import CategoryLanding from "./components/CategoryLanding";
import Policies from "./components/Policies";
import AdminReferenceData from "./components/AdminReferenceData";
import InventoryCleanup from "./components/InventoryCleanup";

function App() {
  return (
    <CartProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/browse" replace />} />

          {/* Everything inside this Layout gets the header */}
          <Route element={<Layout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/browse" element={<PartsBrowse />} />
            <Route path="/categories" element={<CategoryLanding />} />
            <Route path="/about" element={<About />} />
            <Route path="/policies" element={<Policies />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/admin" element={<AdminActions />} />
            <Route path="/admin/add" element={<AddItem />} />
            <Route path="/Admin/Search" element={<SearchItem />} />
            <Route path="/Admin/Orders" element={<AdminOrders />} />
            <Route path="/admin/part/:id" element={<AdminPartDetails />} />
            <Route path="/browse/part/:id" element={<CustomerPartDetails />} />
            <Route path="/admin/refunds" element={<AdminRefunds />} />
            <Route path="/admin/discounts" element={<AdminDiscounts />} />
            <Route path="/admin/catalog-setup" element={<AdminReferenceData />} />
            <Route path="/admin/inventory-cleanup" element={<InventoryCleanup />} />
            <Route
              path="/returns/request"
              element={<CustomerReturnRequest />}
            />
          </Route>

          {/* Only routes that shouldn't show header (e.g., Login) go outside */}
          <Route path="/login" element={<Login />} />
          <Route path="/change-password" element={<ChangePassword />} />
        </Routes>
      </BrowserRouter>
    </CartProvider>
  );
}

export default App;
