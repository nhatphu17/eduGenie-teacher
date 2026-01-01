import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import QuestionBank from './pages/QuestionBank';
import ExamGenerator from './pages/ExamGenerator';
import ExamMixer from './pages/ExamMixer';
import Grading from './pages/Grading';
import LessonPlanGenerator from './pages/LessonPlanGenerator';
import Subscription from './pages/Subscription';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuthStore();
  return user && token ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="questions" element={<QuestionBank />} />
          <Route path="exams/generate" element={<ExamGenerator />} />
          <Route path="exams/mix" element={<ExamMixer />} />
          <Route path="grading" element={<Grading />} />
          <Route path="lesson-plans" element={<LessonPlanGenerator />} />
          <Route path="subscription" element={<Subscription />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

