import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { GraduationCap, Loader2, Download, FileText } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function LessonPlanGenerator() {
  const [formData, setFormData] = useState({
    subjectId: '',
    grade: 6,
    title: '',
    topic: '',
    description: '',
  });

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      return [
        { id: '1', name: 'Toán', grade: 6 },
        { id: '2', name: 'Ngữ văn', grade: 6 },
      ];
    },
  });

  const { mutate: generateLessonPlan, isPending, data: lessonPlan } = useMutation({
    mutationFn: async (data: any) => {
      const res = await axios.post(`${API_URL}/lesson-plans/generate`, data);
      return res.data;
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Tạo giáo án thất bại');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateLessonPlan(formData);
  };

  const handleExport = (lessonPlanId: string) => {
    window.open(`${API_URL}/export/lesson-plan/${lessonPlanId}/word`, '_blank');
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Tạo giáo án</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Thông tin giáo án</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Môn học</label>
              <input
                type="text"
                value={formData.subjectId}
                onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                className="input"
                placeholder="Nhập ID môn học"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Lớp</label>
              <select
                value={formData.grade}
                onChange={(e) => setFormData({ ...formData, grade: parseInt(e.target.value) })}
                className="input"
              >
                {[6, 7, 8, 9].map((grade) => (
                  <option key={grade} value={grade}>
                    Lớp {grade}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tiêu đề</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input"
                placeholder="Ví dụ: Bài 1: Số tự nhiên"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chủ đề (tùy chọn)
              </label>
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                className="input"
                placeholder="Ví dụ: Số tự nhiên và các phép tính"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Mô tả (tùy chọn)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input"
                rows={3}
                placeholder="Mô tả thêm về bài học..."
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full btn btn-primary flex items-center justify-center gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Đang tạo giáo án...
                </>
              ) : (
                <>
                  <GraduationCap size={20} />
                  Tạo giáo án
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Preview */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Xem trước giáo án</h2>

          {!lessonPlan ? (
            <p className="text-gray-500 text-center py-8">
              Điền thông tin và nhấn "Tạo giáo án" để xem kết quả
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{lessonPlan.title}</h3>
                <button
                  onClick={() => handleExport(lessonPlan.id)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  <Download size={16} />
                  Xuất Word
                </button>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Mục tiêu</h4>
                {lessonPlan.objectives && (
                  <div className="space-y-2 text-sm">
                    {lessonPlan.objectives.knowledge && (
                      <div>
                        <p className="font-medium text-gray-700">Kiến thức:</p>
                        <ul className="list-disc list-inside text-gray-600 ml-4">
                          {lessonPlan.objectives.knowledge.map((obj: string, idx: number) => (
                            <li key={idx}>{obj}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {lessonPlan.objectives.skills && (
                      <div>
                        <p className="font-medium text-gray-700">Kỹ năng:</p>
                        <ul className="list-disc list-inside text-gray-600 ml-4">
                          {lessonPlan.objectives.skills.map((skill: string, idx: number) => (
                            <li key={idx}>{skill}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Hoạt động</h4>
                {lessonPlan.activities && (
                  <div className="text-sm space-y-2">
                    {lessonPlan.activities.teacher && (
                      <div>
                        <p className="font-medium text-gray-700">Giáo viên:</p>
                        <ul className="list-disc list-inside text-gray-600 ml-4">
                          {lessonPlan.activities.teacher.map((act: any, idx: number) => (
                            <li key={idx}>{act.activity}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {lessonPlan.content && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Nội dung</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{lessonPlan.content}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
