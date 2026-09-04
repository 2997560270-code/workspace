"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addTeamMentorNote,
  createTeamWorkspace,
  findTeamByInviteCode,
  findTeamForMember,
  joinTeamWorkspace,
  loadTeamDirectory,
  saveTeamDirectory,
  setTeamMemberRole,
  type TeamMember,
  type TeamMemberRole,
  type TeamMentorNote,
  type TeamWorkspace
} from "../lib/team-workspace";
import { requestClientJson } from "../lib/client-api";
import { StoredHistorySchema } from "../lib/api/schemas";

const ROLE_LABELS: Record<TeamMemberRole, string> = { owner: "负责人", coach: "导师", learner: "学习者" };
// 与 app-shell 的 STORAGE_KEY 保持一致：本地试用模式下按账号读取训练历史。
const HISTORY_STORAGE_KEY = "product-drill-direction-a-v1";

type ApiTeam = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  team_members?: Array<{ user_id: string; role: TeamMemberRole; status: "active" | "invited" | "suspended"; joined_at: string }>;
};

type MemberRecordSummary = {
  id: string;
  title: string;
  mode: string;
  totalScore: number;
  completedAt: string;
};

function mapApiTeam(team: ApiTeam, inviteCode = ""): TeamWorkspace {
  return {
    id: team.id,
    name: team.name,
    inviteCode,
    ownerId: team.owner_id,
    createdAt: team.created_at,
    members: (team.team_members ?? []).map((member) => ({
      id: member.user_id,
      name: member.user_id,
      role: member.role,
      status: member.status === "active" ? "active" : "invited",
      joinedAt: member.joined_at,
    })),
  };
}

// FB-009：本地试用模式下，同一浏览器的每个账号各自保存训练历史，
// 负责人按成员 id 读取对应记录，形成成员训练概况。
function loadMemberRecords(memberId: string): MemberRecordSummary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${HISTORY_STORAGE_KEY}:${memberId}`);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    const result = StoredHistorySchema.safeParse(parsed);
    if (!result.success) return [];
    return result.data.records
      .map((record) => ({
        id: record.id,
        title: record.scenarioSnapshot?.shortTitle ?? record.scenarioId,
        mode: record.mode,
        totalScore: record.totalScore,
        completedAt: record.completedAt,
      }))
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
  } catch {
    return [];
  }
}

export function TeamWorkspacePanel({ userId, userName }: { userId: string; userName: string }) {
  const [team, setTeam] = useState<TeamWorkspace | null>(null);
  const [isRemoteTeam, setIsRemoteTeam] = useState(false);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [ready, setReady] = useState(false);
  // FB-011：负责人/导师以自己账号点评成员训练记录。
  const [noteMemberId, setNoteMemberId] = useState("");
  const [noteSessionId, setNoteSessionId] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteStatus, setNoteStatus] = useState("");
  // FB-009：远程（服务端）团队下，负责人/导师按需拉取每位成员的训练概况。
  const [remoteMemberRecords, setRemoteMemberRecords] = useState<Record<string, MemberRecordSummary[]>>({});

  useEffect(() => {
    let active = true;
    void (async () => {
      const remote = await requestClientJson<{ team: ApiTeam | null; configured?: boolean }>("/api/teams").catch(() => null);
      if (!active) return;
      // 只有真正配置了服务端存储时才使用服务端团队；
      // 否则一律使用本地团队目录，保证成员名称、训练概况和点评可用。
      const configured = remote?.configured === true;
      setServerConfigured(configured);
      if (configured && remote?.team) {
        setTeam(mapApiTeam(remote.team));
        setIsRemoteTeam(true);
      } else {
        setTeam(findTeamForMember(loadTeamDirectory(), userId) ?? null);
        setIsRemoteTeam(false);
      }
      setReady(true);
    })();
    return () => { active = false; };
  }, [userId]);

  const myRole = team?.members.find((member) => member.id === userId)?.role ?? null;
  const isManager = myRole === "owner" || myRole === "coach";

  // FB-009：远程团队下由服务端拉取成员概况；本地团队则按账号读取其本机训练历史。
  useEffect(() => {
    if (!isRemoteTeam || !team || !isManager) { setRemoteMemberRecords({}); return; }
    let active = true;
    const memberIds = team.members.filter((member) => member.status === "active").map((member) => member.id);
    void Promise.all(
      memberIds.map((memberId) =>
        requestClientJson<{ records: MemberRecordSummary[] }>(`/api/teams?teamId=${encodeURIComponent(team.id)}&memberId=${encodeURIComponent(memberId)}`)
          .then((result) => [memberId, result?.records ?? []] as const)
          .catch(() => [memberId, []] as const)
      )
    ).then((pairs) => {
      if (!active) return;
      setRemoteMemberRecords(Object.fromEntries(pairs));
    });
    return () => { active = false; };
  }, [isRemoteTeam, team, isManager]); // eslint-disable-line react-hooks/exhaustive-deps

  const memberOverviews = useMemo(() => {
    if (!team) return [];
    return team.members
      .filter((member) => member.status === "active")
      .map((member) => ({ member, records: isRemoteTeam ? remoteMemberRecords[member.id] ?? [] : loadMemberRecords(member.id) }));
  }, [team, isRemoteTeam, remoteMemberRecords]);

  const noteMemberRecords = memberOverviews.find((item) => item.member.id === noteMemberId)?.records ?? [];
  const teamNotes: TeamMentorNote[] = useMemo(
    () => [...(team?.mentorNotes ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [team]
  );

  function persist(nextTeam: TeamWorkspace) {
    const directory = loadTeamDirectory();
    saveTeamDirectory([...directory.filter((item) => item.id !== nextTeam.id), nextTeam]);
    setTeam(nextTeam);
  }

  async function create() {
    if (teamName.trim().length < 2) return;
    if (serverConfigured) {
      const remote = await requestClientJson<{ team: ApiTeam }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "create", name: teamName }) });
      if (remote?.team) {
        const invitation = await requestClientJson<{ invitation: { code: string } }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "invite", teamId: remote.team.id, role: "learner" }) });
        setTeam(mapApiTeam(remote.team, invitation?.invitation.code ?? ""));
        setIsRemoteTeam(true);
        setTeamName("");
        return;
      }
    }
    persist(createTeamWorkspace({ ownerId: userId, ownerName: userName, name: teamName }));
    setIsRemoteTeam(false);
    setTeamName("");
  }

  async function join() {
    if (serverConfigured) {
      const remote = await requestClientJson<{ team: ApiTeam }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "join", code: inviteCode }) });
      if (remote?.team) {
        setTeam(mapApiTeam(remote.team));
        setIsRemoteTeam(true);
        setInviteCode("");
        setJoinError("");
        return;
      }
    }
    const directory = loadTeamDirectory();
    const target = findTeamByInviteCode(directory, inviteCode);
    if (!target) {
      setJoinError("找不到这个邀请码，请确认复制完整或让团队负责人重新发送。");
      return;
    }
    const nextTeam = joinTeamWorkspace(target, { memberId: userId, memberName: userName });
    persist(nextTeam);
    setIsRemoteTeam(false);
    setInviteCode("");
    setJoinError("");
  }

  async function saveNote() {
    if (!team || !noteMemberId || !noteSessionId || noteContent.trim().length < 4) return;
    setNoteStatus("正在保存点评…");
    if (isRemoteTeam) {
      const remote = await requestClientJson<{ note: { id: string } }>("/api/teams", {
        method: "POST",
        body: JSON.stringify({ action: "mentor_note", teamId: team.id, sessionId: noteSessionId, content: noteContent })
      });
      if (remote?.note) {
        setNoteStatus(`点评已保存，点评人为 ${userName}（${ROLE_LABELS[myRole ?? "learner"]}）。`);
        setNoteContent("");
        return;
      }
      setNoteStatus("点评保存失败：只有团队负责人或导师可以点评，请稍后重试。");
      return;
    }
    persist(addTeamMentorNote(team, { sessionId: noteSessionId, authorId: userId, authorName: userName, content: noteContent }));
    setNoteStatus(`点评已保存，点评人为 ${userName}（${ROLE_LABELS[myRole ?? "learner"]}）。`);
    setNoteContent("");
  }

  // RT-005：负责人调整成员角色（仅在 learner/coach 之间；owner 角色不可改）。
  async function changeRole(memberId: string, role: TeamMemberRole) {
    if (!team || role === "owner") return;
    if (isRemoteTeam) {
      const remote = await requestClientJson<{ team: ApiTeam }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "set_role", teamId: team.id, memberId, role }) });
      if (remote?.team) setTeam(mapApiTeam(remote.team));
      return;
    }
    persist(setTeamMemberRole(team, memberId, role));
  }

  if (!ready) return null;

  return (
    <section className="team-workspace-panel surface" data-testid="team-workspace-panel">
      <div className="section-heading">
        <div>
          <span className="section-kicker">企业团队</span>
          <h2>{team ? team.name : "建立一个训练团队"}</h2>
        </div>
        <span className="status-tag">本地试用</span>
      </div>
      <p className="team-workspace-boundary">当前团队数据保存在本机，用于验证邀请和成员流程；正式版本还需要服务端账号、权限和跨设备同步。</p>
      {team ? (
        <>
          <div className="team-invite-strip">
            <div><span>团队邀请码</span><strong data-testid="team-invite-code">{team.inviteCode || "由服务端管理"}</strong></div>
            <p>把邀请码交给成员，他们可在同一浏览器的团队入口加入。</p>
          </div>
          {/* FB-009：任何成员都能看到完整成员列表与自己的角色定位 */}
          <div className="team-member-list" data-testid="team-member-list">
            {team.members.map((member) => (
              <div className="team-member" data-testid={`team-member-${member.id}`} key={member.id}>
                <span>{member.name}{member.id === userId ? "（你）" : ""}</span>
                <small>{ROLE_LABELS[member.role]} · {member.status === "active" ? "已加入" : "待加入"}</small>
                {/* RT-005：负责人可在 learner/coach 之间调整成员角色（不能改 owner） */}
                {myRole === "owner" && member.role !== "owner" ? (
                  <select
                    aria-label={`调整 ${member.name} 的角色`}
                    data-testid={`team-member-role-${member.id}`}
                    onChange={(event) => { void changeRole(member.id, event.target.value as TeamMemberRole); }}
                    value={member.role}
                  >
                    <option value="learner">学习者</option>
                    <option value="coach">导师</option>
                  </select>
                ) : null}
              </div>
            ))}
          </div>
          {/* FB-009/FB-011：负责人与导师查看成员训练概况，并直接以自己账号点评（本地与远程团队均可用） */}
          {isManager ? (
            <div className="team-manager-view" data-testid="team-manager-view">
              <div className="team-manager-heading">
                <h3>成员训练概况</h3>
                <p>负责人和导师可以查看每位成员的训练记录，并以自己的账号留下点评，无需登录成员账号。</p>
              </div>
              {memberOverviews.map(({ member, records }) => (
                <article className="team-member-overview" data-testid={`team-member-overview-${member.id}`} key={member.id}>
                  <div className="team-member-overview-heading">
                    <strong>{member.name}{member.id === userId ? "（你）" : ""}</strong>
                    <span>{ROLE_LABELS[member.role]} · 已完成 {records.length} 次训练</span>
                  </div>
                  {records.length ? (
                    <ul>
                      {records.slice(0, 3).map((record) => (
                        <li data-testid={`member-record-${record.id}`} key={record.id}>
                          <span>{record.title}</span>
                          <small>{record.mode} · 证据分 {record.totalScore} · {new Date(record.completedAt).toLocaleString("zh-CN")}</small>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="team-member-empty">该成员还没有训练记录。</p>}
                </article>
              ))}
              <div className="team-mentor-form" data-testid="team-mentor-form">
                <h3>点评成员训练</h3>
                <div className="team-mentor-fields">
                  <label>
                    <span>成员</span>
                    <select
                      aria-label="选择要点评的成员"
                      data-testid="team-mentor-member"
                      onChange={(event) => { setNoteMemberId(event.target.value); setNoteSessionId(""); }}
                      value={noteMemberId}
                    >
                      <option value="">选择成员</option>
                      {team.members.filter((member) => member.status === "active").map((member) => (
                        <option key={member.id} value={member.id}>{member.name}（{ROLE_LABELS[member.role]}）</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>训练记录</span>
                    <select
                      aria-label="选择要点评的训练记录"
                      data-testid="team-mentor-session"
                      disabled={!noteMemberId}
                      onChange={(event) => setNoteSessionId(event.target.value)}
                      value={noteSessionId}
                    >
                      <option value="">{noteMemberId ? "选择训练记录" : "先选择成员"}</option>
                      {noteMemberRecords.map((record) => (
                        <option key={record.id} value={record.id}>{record.title}（{record.mode} · {record.totalScore} 分）</option>
                      ))}
                    </select>
                  </label>
                </div>
                <textarea
                  aria-label="点评内容"
                  onChange={(event) => setNoteContent(event.target.value)}
                  placeholder="写下对这次训练的具体建议（至少 4 个字）"
                  rows={3}
                  value={noteContent}
                />
                <div className="team-mentor-actions">
                  <button
                    className="button button-secondary"
                    data-testid="team-mentor-save"
                    disabled={!noteMemberId || !noteSessionId || noteContent.trim().length < 4}
                    onClick={() => { void saveNote(); }}
                    type="button"
                  >以我的身份保存点评</button>
                  <p className="mentor-note-hint" data-testid="team-mentor-hint" role="status">
                    {!noteMemberId || !noteSessionId
                      ? "请先选择成员和训练记录。"
                      : noteContent.trim().length < 4
                        ? `点评内容至少 4 个字（当前 ${noteContent.trim().length} 字）。`
                        : `将以 ${userName}（${ROLE_LABELS[myRole ?? "learner"]}）的身份保存。`}
                  </p>
                </div>
                {noteStatus ? <p className="team-mentor-status" data-testid="team-mentor-status" role="status">{noteStatus}</p> : null}
              </div>
            </div>
          ) : null}
          {teamNotes.length ? (
            <div className="team-notes" data-testid="team-notes">
              <h3>团队点评记录</h3>
              {teamNotes.slice(0, 5).map((note) => (
                <blockquote data-testid={`team-note-${note.id}`} key={note.id}>
                  <strong>{note.authorName}</strong>
                  <span>{note.content}</span>
                  <small>{new Date(note.createdAt).toLocaleString("zh-CN")}</small>
                </blockquote>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="team-actions">
          <label><span>团队名称</span><input aria-label="团队名称" onChange={(event) => setTeamName(event.target.value)} placeholder="例如：产品新人训练小组" value={teamName} /></label>
          {teamName.trim() && teamName.trim().length < 2 ? <p className="mentor-note-hint" data-testid="team-name-hint" role="status">团队名称至少 2 个字（当前 {teamName.trim().length} 字）。</p> : null}
          <button className="button button-primary" disabled={teamName.trim().length < 2} onClick={create} type="button">创建团队</button>
          <div className="team-divider"><span>或</span></div>
          <label><span>已有邀请码</span><input aria-label="团队邀请码" onChange={(event) => setInviteCode(event.target.value)} placeholder="输入 4–16 位邀请码（字母数字）" value={inviteCode} /></label>
          {inviteCode.trim() && inviteCode.trim().length < 4 ? <p className="mentor-note-hint" data-testid="team-invite-hint" role="status">邀请码至少 4 位（当前 {inviteCode.trim().length} 位）。</p> : null}
          <button className="button button-secondary" disabled={inviteCode.trim().length < 4} onClick={join} type="button">加入团队</button>
          {joinError ? <p className="form-error" role="alert">{joinError}</p> : null}
        </div>
      )}
    </section>
  );
}
