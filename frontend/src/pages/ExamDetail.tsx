import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { ClipboardList, FileText, Calendar, User, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: exam, isLoading } = useQuery({
    queryKey: ['exam', id],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/exams/${id}`);
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Đang tải...</p>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Không tìm thấy đề thi</p>
        <Link to="/exams" className="btn btn-primary mt-4">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {exam.title || `Đề thi ${exam.subject?.name || ''} lớp ${exam.grade}`}
          </h1>
          <p className="text-gray-600">{exam.description || 'Không có mô tả'}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${API_URL}/export/exam/${exam.id}/pdf`}
            target="_blank"
            className="btn btn-secondary"
          >
            <Download size={20} className="mr-2" />
            Xuất PDF
          </a>
          <a
            href={`${API_URL}/export/exam/${exam.id}/word`}
            target="_blank"
            className="btn btn-secondary"
          >
            <Download size={20} className="mr-2" />
            Xuất Word
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <FileText className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Số câu hỏi</p>
              <p className="text-2xl font-bold text-gray-900">
                {exam.questions?.length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <Calendar className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Thời gian</p>
              <p className="text-2xl font-bold text-gray-900">{exam.duration} phút</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-3">
            <User className="text-primary-600" size={24} />
            <div>
              <p className="text-sm text-gray-600">Lớp</p>
              <p className="text-2xl font-bold text-gray-900">Lớp {exam.grade}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Danh sách câu hỏi</h2>
        {!exam.questions || exam.questions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Chưa có câu hỏi nào</p>
        ) : (
          <div className="space-y-6">
            {exam.questions.map((eq: any, index: number) => {
              const question = eq.question;
              return (
                <div key={eq.id} className="border-b border-gray-200 pb-6 last:border-0">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-semibold">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {question.type}
                        </span>
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {question.difficulty}
                        </span>
                        <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded">
                          {eq.points} điểm
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium mb-3">{question.content}</p>
                      {question.options && (
                        <div className="space-y-2 mb-3">
                          {question.options.map((option: string, optIndex: number) => (
                            <div
                              key={optIndex}
                              className={`p-2 rounded ${
                                String(optIndex) === question.correctAnswer
                                  ? 'bg-green-50 border border-green-200'
                                  : 'bg-gray-50'
                              }`}
                            >
                              <span className="font-medium mr-2">
                                {String.fromCharCode(65 + optIndex)}.
                              </span>
                              {option}
                              {String(optIndex) === question.correctAnswer && (
                                <span className="ml-2 text-green-600 font-semibold">✓ Đáp án đúng</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {question.explanation && (
                        <div className="mt-3 p-3 bg-blue-50 rounded">
                          <p className="text-sm font-medium text-blue-900 mb-1">Giải thích:</p>
                          <p className="text-sm text-blue-800">{question.explanation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


