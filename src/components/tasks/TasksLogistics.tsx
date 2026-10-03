import React, { useState } from 'react';
import { CheckSquare, Clock, User, CheckCircle2, Circle } from 'lucide-react';
import { useFuelData } from '../../context/FuelDataContext';

export const TasksLogistics: React.FC = () => {
  const { tasks, toggleTask, searchQuery } = useFuelData();
  const [filterCategory, setFilterCategory] = useState<string>('الكل');

  const categories = ['الكل', 'صيانة', 'تفريغ', 'فحص جودة', 'جرد'];

  const filteredTasks = tasks.filter((t) => {
    const matchesCat = filterCategory === 'الكل' || t.category === filterCategory;
    const matchesSearch =
      t.title.includes(searchQuery) ||
      t.assignee.includes(searchQuery) ||
      t.description.includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-blue-600" />
            <span>إدارة المهام والعمليات اللوجستية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جدولة وتتبع مهام فحص الجودة، صيانة الحساسات، وتفريغ الصهاريج
          </p>
        </div>

        <div className="px-4 py-2 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-xs font-bold text-blue-700 dark:text-blue-300">
          تم إنجاز {completedCount} من أصل {tasks.length} مهام
        </div>
      </div>

      {/* Main Task List Card */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-soft-card space-y-4">
        {/* Category Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl self-start w-fit">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterCategory === cat
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onClick={() => toggleTask(task.id)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                task.completed
                  ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 opacity-60'
                  : 'bg-white dark:bg-slate-800/70 border-slate-200/80 dark:border-slate-700 hover:border-blue-500 shadow-xs'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <button className="mt-0.5 text-blue-600 dark:text-blue-400 shrink-0">
                  {task.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-100 dark:fill-emerald-950" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                  )}
                </button>

                <div>
                  <h4
                    className={`font-bold text-sm text-slate-900 dark:text-white ${
                      task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''
                    }`}
                  >
                    {task.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {task.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-2.5 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
                      <User className="w-3 h-3 text-blue-500" />
                      {task.assignee}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      {task.dueDate}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">
                      {task.category}
                    </span>
                  </div>
                </div>
              </div>

              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shrink-0 ${
                  task.priority === 'عالية'
                    ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200'
                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                }`}
              >
                أولوية {task.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
