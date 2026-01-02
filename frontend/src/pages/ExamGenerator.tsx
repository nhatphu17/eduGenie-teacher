import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ExamGenerator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    subjectId: '',
    grade: 6,
    duration: 45,
    difficultyDistribution: { NB: 2, TH: 3, VD: 1 },
    questionTypes: ['MCQ' as const],
    title: '',
    description: '',
  });

  // Fetch subjects from backend
  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const res = await axios.get(`${API_URL}/subjects`);
      return res.data;
    },
  });

  const { mutate: generateExam, isPending } = useMutation({
    mutationFn: async (data: any) => {
      const res = await axios.post(`${API_URL}/exams/generate`, data);
      return res.data;
    },
    onSuccess: (data) => {
      console.log('Exam created:', data);
      alert(`Tạo đề thi thành công! Đã tạo ${data.exam?.questions?.length || 0} câu hỏi.`);
      // Invalidate exams query to refresh list
      queryClient.invalidateQueries({ queryKey: ['exams'] });
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Có lỗi xảy ra');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateExam(formData);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Tạo đề thi với AI</h1>

      <div className="card max-w-2xl">
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Môn học</label>
              {subjectsLoading ? (
                <p className="text-gray-500">Đang tải...</p>
              ) : (
                <select
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                  className="input"
                  required
                >
                  <option value="">Chọn môn học</option>
                  {subjects
                    ?.filter((s: any) => s.grade === formData.grade)
                    .map((subject: any) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                </select>
              )}
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Thời gian (phút)</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                className="input"
                min={15}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phân bố độ khó
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-gray-600">Nhận biết</label>
                  <input
                    type="number"
                    value={formData.difficultyDistribution.NB}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficultyDistribution: {
                          ...formData.difficultyDistribution,
                          NB: parseInt(e.target.value),
                        },
                      })
                    }
                    className="input"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Thông hiểu</label>
                  <input
                    type="number"
                    value={formData.difficultyDistribution.TH}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficultyDistribution: {
                          ...formData.difficultyDistribution,
                          TH: parseInt(e.target.value),
                        },
                      })
                    }
                    className="input"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Vận dụng</label>
                  <input
                    type="number"
                    value={formData.difficultyDistribution.VD}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        difficultyDistribution: {
                          ...formData.difficultyDistribution,
                          VD: parseInt(e.target.value),
                        },
                      })
                    }
                    className="input"
                    min={0}
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full btn btn-primary"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin mr-2" size={20} />
                  Đang tạo đề thi...
                </>
              ) : (
                'Tạo đề thi'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


