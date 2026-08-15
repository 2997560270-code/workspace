"use client";

import { useEffect, useState } from "react";
import { completeCourseLesson, courseCompletion, COURSES, loadCourseProgress, type CourseProgress } from "../lib/course-content";

export function CoursePanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [progress, setProgress] = useState<CourseProgress>({});
  const [selectedCourseId, setSelectedCourseId] = useState(COURSES[0].id);
  const selectedCourse = COURSES.find((course) => course.id === selectedCourseId) ?? COURSES[0];

  useEffect(() => setProgress(loadCourseProgress(userId)), [userId]);

  return (
    <div className="course-shell">
      <section className="surface course-intro">
        <div className="section-heading"><div><span className="section-kicker">课程内容</span><h2>把训练行为带回真实工作</h2></div><button className="back-button" onClick={onClose} type="button">← 返回训练地图</button></div>
        <p>课程提供短知识点和行动练习，但不会替代场景训练，也不会直接生成能力证据。</p>
      </section>
      <div className="course-layout">
        <aside className="course-list surface">
          {COURSES.map((course) => <button className={course.id === selectedCourse.id ? "active" : ""} key={course.id} onClick={() => setSelectedCourseId(course.id)} type="button"><strong>{course.title}</strong><small>{courseCompletion(course, progress)}% 完成 · {course.lessons.length} 节</small></button>)}
        </aside>
        <section className="course-detail surface" data-testid="course-detail">
          <span className="section-kicker">学习路径</span><h2>{selectedCourse.title}</h2><p>{selectedCourse.description}</p>
          <div className="course-lessons">
            {selectedCourse.lessons.map((lesson, index) => {
              const completed = progress[selectedCourse.id]?.includes(lesson.id) ?? false;
              return <article className={completed ? "course-lesson completed" : "course-lesson"} key={lesson.id}><span className="course-number">0{index + 1}</span><div><h3>{lesson.title}</h3><p>{lesson.summary}</p><details><summary>查看行动练习</summary><p>{lesson.exercise}</p></details></div><button className="button button-secondary" disabled={completed} onClick={() => setProgress(completeCourseLesson(userId, selectedCourse.id, lesson.id))} type="button">{completed ? "已完成" : "标记完成"}</button></article>;
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
