"use client";

import { useEffect, useState } from "react";
import {
  createTeamWorkspace,
  findTeamByInviteCode,
  findTeamForMember,
  joinTeamWorkspace,
  loadTeamDirectory,
  saveTeamDirectory,
  type TeamMemberRole,
  type TeamWorkspace
} from "../lib/team-workspace";
import { requestClientJson } from "../lib/client-api";

const ROLE_LABELS: Record<TeamMemberRole, string> = { owner: "负责人", coach: "导师", learner: "学习者" };

type ApiTeam = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  team_members?: Array<{ user_id: string; role: TeamMemberRole; status: "active" | "invited" | "suspended"; joined_at: string }>;
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

export function TeamWorkspacePanel({ userId, userName }: { userId: string; userName: string }) {
  const [team, setTeam] = useState<TeamWorkspace | null>(null);
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      const remote = await requestClientJson<{ team: ApiTeam | null }>("/api/teams");
      if (!active) return;
      if (remote?.team) setTeam(mapApiTeam(remote.team));
      else setTeam(findTeamForMember(loadTeamDirectory(), userId) ?? null);
      setReady(true);
    })();
    return () => { active = false; };
  }, [userId]);

  function persist(nextTeam: TeamWorkspace) {
    const directory = loadTeamDirectory();
    saveTeamDirectory([...directory.filter((item) => item.id !== nextTeam.id), nextTeam]);
    setTeam(nextTeam);
  }

  async function create() {
    if (teamName.trim().length < 2) return;
    const remote = await requestClientJson<{ team: ApiTeam }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "create", name: teamName }) });
    if (remote?.team) {
      const invitation = await requestClientJson<{ invitation: { code: string } }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "invite", teamId: remote.team.id, role: "learner" }) });
      setTeam(mapApiTeam(remote.team, invitation?.invitation.code ?? ""));
      setTeamName("");
      return;
    }
    persist(createTeamWorkspace({ ownerId: userId, ownerName: userName, name: teamName }));
    setTeamName("");
  }

  async function join() {
    const remote = await requestClientJson<{ team: ApiTeam }>("/api/teams", { method: "POST", body: JSON.stringify({ action: "join", code: inviteCode }) });
    if (remote?.team) {
      setTeam(mapApiTeam(remote.team));
      setInviteCode("");
      setJoinError("");
      return;
    }
    const directory = loadTeamDirectory();
    const target = findTeamByInviteCode(directory, inviteCode);
    if (!target) {
      setJoinError("找不到这个邀请码，请确认复制完整或让团队负责人重新发送。");
      return;
    }
    const nextTeam = joinTeamWorkspace(target, { memberId: userId, memberName: userName });
    persist(nextTeam);
    setInviteCode("");
    setJoinError("");
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
            <div><span>团队邀请码</span><strong data-testid="team-invite-code">{team.inviteCode}</strong></div>
            <p>把邀请码交给成员，他们可在同一浏览器的团队入口加入。</p>
          </div>
          <div className="team-member-list">
            {team.members.map((member) => <div className="team-member" key={member.id}><span>{member.name}</span><small>{ROLE_LABELS[member.role]} · {member.status === "active" ? "已加入" : "待加入"}</small></div>)}
          </div>
        </>
      ) : (
        <div className="team-actions">
          <label><span>团队名称</span><input aria-label="团队名称" onChange={(event) => setTeamName(event.target.value)} placeholder="例如：产品新人训练小组" value={teamName} /></label>
          <button className="button button-primary" disabled={teamName.trim().length < 2} onClick={create} type="button">创建团队</button>
          <div className="team-divider"><span>或</span></div>
          <label><span>已有邀请码</span><input aria-label="团队邀请码" onChange={(event) => setInviteCode(event.target.value)} placeholder="输入 8 位邀请码" value={inviteCode} /></label>
          <button className="button button-secondary" disabled={inviteCode.trim().length < 4} onClick={join} type="button">加入团队</button>
          {joinError ? <p className="form-error" role="alert">{joinError}</p> : null}
        </div>
      )}
    </section>
  );
}
