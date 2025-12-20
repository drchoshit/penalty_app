import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import StudentsPage from "./pages/StudentsPage";
import RecordsPage from "./pages/RecordsPage";
import AssignPage from "./pages/AssignPage";
import SettingsPage from "./pages/SettingsPage";
import SmsPage from "./pages/SmsPage";
import NotesPage from "./pages/NotesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<StudentsPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/assign" element={<AssignPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/sms" element={<SmsPage />} />
        <Route path="/notes" element={<NotesPage />} />
      </Route>
    </Routes>
  );
}
