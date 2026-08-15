import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeCourseLesson, courseCompletion, COURSES, loadCourseProgress } from "../src/lib/course-content";

describe("course content", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    } });
  });

  it("contains short lessons with a practical exercise", () => {
    expect(COURSES.length).toBeGreaterThanOrEqual(3);
    expect(COURSES.every((course) => course.lessons.every((lesson) => lesson.summary && lesson.exercise))).toBe(true);
  });

  it("stores completion and reports progress without creating training evidence", () => {
    const course = COURSES[0];
    const next = completeCourseLesson("user-1", course.id, course.lessons[0].id);
    expect(courseCompletion(course, next)).toBe(Math.round(100 / course.lessons.length));
    expect(loadCourseProgress("user-1")[course.id]).toContain(course.lessons[0].id);
  });
});
