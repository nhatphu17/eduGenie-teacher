import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ClipboardList, FileText, Calendar, User } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ExamsList() {
  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/exams`);
      return res.data;
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Danh sách đề thi</h1>
          <p className="text-gray-600 mt-2">Xem và quản lý các đề thi đã tạo</p>
        </div>
        <Link to="/exams/generate" className="btn btn-primary">
          Tạo đề thi mới
        </Link>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Đang tải...</p>
        </div>
      ) : !exams || exams.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardList className="mx-auto text-gray-400 mb-4" size={48} />
          <p className="text-gray-500 mb-4">Chưa có đề thi nào</p>
          <Link to="/exams/generate" className="btn btn-primary">
            Tạo đề thi đầu tiên
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.map((exam: any) => (
            <div key={exam.id} className="card hover:shadow-lg transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {exam.title || `Đề thi ${exam.subject?.name || ''} lớp ${exam.grade}`}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {exam.description || 'Không có mô tả'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText size={16} />
                  <span>{exam.questions?.length || 0} câu hỏi</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  <span>{exam.duration} phút</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User size={16} />
                  <span>Lớp {exam.grade}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/exams/${exam.id}`}
                  className="btn btn-secondary flex-1 text-center"
                >
                  Xem chi tiết
                </Link>
                <Link
                  to={`/exams/mix?examId=${exam.id}`}
                  className="btn btn-primary flex-1 text-center"
                >
                  Trộn đề
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

