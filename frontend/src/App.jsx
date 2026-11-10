import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { PrivateRoute, AdminRoute } from './components/PrivateRoute'
import Navbar from './components/Navbar'

import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import SubmitComplaint from './pages/SubmitComplaint'
import MyComplaints from './pages/MyComplaints'
import UserComplaintDetail from './pages/UserComplaintDetail'
import AdminDashboard from './pages/AdminDashboard'
import AdminComplaints from './pages/AdminComplaints'
import AdminComplaintDetail from './pages/AdminComplaintDetail'
import Analytics from './pages/Analytics'
import AdminUsers from './pages/AdminUsers'
import AdminAssignments from './pages/AdminAssignments'
import AdminWorkload from './pages/AdminWorkload'
import AdminPerformance from './pages/AdminPerformance'

export default function App() {
  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main>
            <Routes>

              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />


              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/submit" element={<PrivateRoute><SubmitComplaint /></PrivateRoute>} />
              <Route path="/my-complaints" element={<PrivateRoute><MyComplaints /></PrivateRoute>} />
              <Route path="/my-complaints/:category" element={<PrivateRoute><MyComplaints /></PrivateRoute>} />
              <Route path="/complaint/:complaintId" element={<PrivateRoute><UserComplaintDetail /></PrivateRoute>} />


              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/complaints" element={<AdminRoute><AdminComplaints /></AdminRoute>} />
              <Route path="/admin/complaints/:complaintId" element={<AdminRoute><AdminComplaintDetail /></AdminRoute>} />
              <Route path="/admin/analytics" element={<AdminRoute><Analytics /></AdminRoute>} />
              <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
              <Route path="/admin/assignments" element={<AdminRoute><AdminAssignments /></AdminRoute>} />
              <Route path="/admin/workload" element={<AdminRoute><AdminWorkload /></AdminRoute>} />
              <Route path="/admin/performance" element={<AdminRoute><AdminPerformance /></AdminRoute>} />


              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  )
}
