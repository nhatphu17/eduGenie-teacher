import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { BookOpen, FileText, ClipboardList, Shuffle, CheckSquare, GraduationCap, CreditCard, LogOut } from 'lucide-react';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: BookOpen },
    { path: '/questions', label: 'Ngân hàng câu hỏi', icon: FileText },
    { path: '/exams/generate', label: 'Tạo đề thi', icon: ClipboardList },
    { path: '/exams/mix', label: 'Trộn đề', icon: Shuffle },
    { path: '/grading', label: 'Chấm bài', icon: CheckSquare },
    { path: '/lesson-plans', label: 'Giáo án', icon: GraduationCap },
    { path: '/subscription', label: 'Gói đăng ký', icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg z-10">
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-primary-600">EduGenie Teacher</h1>
          <p className="text-sm text-gray-500 mt-1">AI Assistant cho Giáo viên</p>
        </div>
        <nav className="p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-2 transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
          <div className="mb-3 px-4">
            <p className="text-sm font-medium text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
            <p className="text-xs text-primary-600 mt-1">
              Gói: {user?.subscriptionPlan?.name || 'FREE'}
            </p>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}

