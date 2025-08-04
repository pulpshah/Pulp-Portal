"use client";

import { useSession, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Button, Input } from "@pulp/ui";

interface Team {
  id: string;
  name: string;
  memberCount: number;
  members?: User[];
  invitations?: TeamInvitation[];
}

interface TeamInvitation {
  id: string;
  name: string;
  email: string;
  type: "invited";
  invitationId: string;
  invitedBy: string;
  invitedAt: string;
}

interface Organization {
  id: string;
  name: string;
  role: "owner" | "member";
  teams: Team[];
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Invitation {
  id: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  team: {
    id: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
  };
  inviter: {
    id: string;
    name: string;
    email: string;
  };
}

export default function HomePage() {
  const { data: session, status } = useSession();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitationsLoading, setInvitationsLoading] = useState(true);
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [teamMembers, setTeamMembers] = useState<Record<string, User[]>>({});
  const [teamInvitations, setTeamInvitations] = useState<
    Record<string, TeamInvitation[]>
  >({});

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/auth/signin" });
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch("/api/organizations");
      if (response.ok) {
        const data = await response.json();
        setOrganizations(data.organizations || []);
      }
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const response = await fetch("/api/invitations");
      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations || []);
      }
    } catch (error) {
      console.error("Error fetching invitations:", error);
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleInvitation = async (
    invitationId: string,
    action: "accept" | "reject",
  ) => {
    try {
      const response = await fetch(`/api/invitations/${invitationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        // Refresh both invitations and organizations
        await Promise.all([fetchInvitations(), fetchOrganizations()]);
        alert(`Invitation ${action}ed successfully!`);
      } else {
        const error = await response.json();
        alert(error.message || `Failed to ${action} invitation`);
      }
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
      alert(`Failed to ${action} invitation`);
    }
  };

  const createOrganization = async () => {
    if (!newOrgName.trim()) return;

    try {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newOrgName.trim() }),
      });

      if (response.ok) {
        setNewOrgName("");
        setShowCreateOrgModal(false);
        fetchOrganizations();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to create organization");
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      alert("Failed to create organization");
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim() || !selectedOrgId) return;

    try {
      const response = await fetch(
        `/api/organizations/${selectedOrgId}/teams`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newTeamName.trim() }),
        },
      );

      if (response.ok) {
        setNewTeamName("");
        setShowCreateTeamModal(false);
        setSelectedOrgId("");
        fetchOrganizations();
      } else {
        const error = await response.json();
        alert(error.message || "Failed to create team");
      }
    } catch (error) {
      console.error("Error creating team:", error);
      alert("Failed to create team");
    }
  };

  const inviteUser = async () => {
    if (!inviteEmail.trim() || !selectedTeamId) return;

    try {
      const response = await fetch(`/api/teams/${selectedTeamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      if (response.ok) {
        setInviteEmail("");
        setShowInviteModal(false);
        // Refresh team members if this team is expanded
        if (expandedTeams.has(selectedTeamId)) {
          await fetchTeamMembers(selectedTeamId);
        }
        setSelectedTeamId("");
        fetchOrganizations();
        alert("Invitation sent successfully!");
      } else {
        const error = await response.json();
        alert(error.message || "Failed to invite user");
      }
    } catch (error) {
      console.error("Error inviting user:", error);
      alert("Failed to invite user");
    }
  };

  const toggleOrgExpansion = (orgId: string) => {
    const newExpandedOrgs = new Set(expandedOrgs);
    if (newExpandedOrgs.has(orgId)) {
      newExpandedOrgs.delete(orgId);
    } else {
      newExpandedOrgs.add(orgId);
    }
    setExpandedOrgs(newExpandedOrgs);
  };

  const toggleTeamExpansion = async (teamId: string) => {
    const newExpandedTeams = new Set(expandedTeams);
    if (newExpandedTeams.has(teamId)) {
      newExpandedTeams.delete(teamId);
    } else {
      newExpandedTeams.add(teamId);
      // Fetch team members if not already loaded
      if (!teamMembers[teamId]) {
        await fetchTeamMembers(teamId);
      }
    }
    setExpandedTeams(newExpandedTeams);
  };

  const fetchTeamMembers = async (teamId: string) => {
    try {
      const response = await fetch(`/api/teams/${teamId}/invite`);
      if (response.ok) {
        const data = await response.json();
        setTeamMembers((prev) => ({
          ...prev,
          [teamId]: data.members || [],
        }));
        setTeamInvitations((prev) => ({
          ...prev,
          [teamId]: data.invitations || [],
        }));
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchOrganizations();
      fetchInvitations();
    }
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Organizations & Teams</h1>
          <p className="text-muted-foreground mt-2">
            Manage your organizations, teams, and collaborate with others
          </p>
        </div>
        {session?.user && (
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        )}
      </div>

      {/* User Info */}
      {session?.user && (
        <div className="bg-card border rounded-lg p-6 mb-8 max-w-md">
          <h2 className="text-xl font-semibold mb-4">Welcome back!</h2>
          <div className="space-y-2">
            <p>
              <span className="font-medium">Name:</span>{" "}
              {session.user.name || "Not provided"}
            </p>
            <p>
              <span className="font-medium">Email:</span>{" "}
              {session.user.email || "Not provided"}
            </p>
          </div>
        </div>
      )}

      {/* Pending Invitations Section */}
      {!invitationsLoading && invitations.length > 0 && (
        <div className="bg-card border rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            📨 Pending Invitations
            <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
              {invitations.length}
            </span>
          </h2>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="bg-background border rounded p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-medium">
                      {invitation.organization.name} → {invitation.team.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Invited by{" "}
                      <span className="font-medium">
                        {invitation.inviter.name}
                      </span>{" "}
                      ({invitation.inviter.email})
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(invitation.createdAt).toLocaleDateString()} at{" "}
                      {new Date(invitation.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => handleInvitation(invitation.id, "accept")}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleInvitation(invitation.id, "reject")}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organizations Section */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold">Your Organizations</h2>
          <Button onClick={() => setShowCreateOrgModal(true)}>
            Create Organization
          </Button>
        </div>

        {organizations.length === 0 ? (
          <div className="text-center py-12 bg-card border rounded-lg">
            <p className="text-muted-foreground">
              No organizations found. Create your first organization to get
              started!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {organizations.map((org) => (
              <div key={org.id} className="bg-card border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{org.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      Role: {org.role} • {org.teams.length} team(s)
                    </p>
                  </div>
                  <div className="space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleOrgExpansion(org.id)}
                    >
                      {expandedOrgs.has(org.id) ? "Hide Teams" : "Show Teams"}
                    </Button>
                    {org.role === "owner" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrgId(org.id);
                          setShowCreateTeamModal(true);
                        }}
                      >
                        Add Team
                      </Button>
                    )}
                  </div>
                </div>

                {expandedOrgs.has(org.id) && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Teams:</h4>
                    {org.teams.map((team) => (
                      <div
                        key={team.id}
                        className="bg-background border rounded p-4"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium">{team.name}</h5>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleTeamExpansion(team.id)}
                                className="text-xs"
                              >
                                {expandedTeams.has(team.id)
                                  ? "Hide Members"
                                  : "View Members"}
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {team.memberCount} member(s)
                            </p>
                          </div>
                          {(org.role === "owner" ||
                            team.name === "Owners Team") && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTeamId(team.id);
                                setShowInviteModal(true);
                              }}
                            >
                              Invite User
                            </Button>
                          )}
                        </div>

                        {expandedTeams.has(team.id) && (
                          <div className="mt-4 pt-4 border-t space-y-4">
                            {/* Current Members */}
                            <div>
                              <h6 className="font-medium mb-3">
                                Team Members:
                              </h6>
                              {teamMembers[team.id]?.length > 0 ? (
                                <div className="space-y-2">
                                  {teamMembers[team.id].map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center gap-3 p-2 bg-card rounded border"
                                    >
                                      <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                                        {member.name?.charAt(0).toUpperCase() ||
                                          member.email.charAt(0).toUpperCase()}
                                      </div>
                                      <div className="flex-1">
                                        <p className="font-medium text-sm">
                                          {member.name || "No name"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {member.email}
                                        </p>
                                      </div>
                                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                        Member
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground italic">
                                  {teamMembers[team.id]
                                    ? "No members found"
                                    : "Loading members..."}
                                </p>
                              )}
                            </div>

                            {/* Pending Invitations */}
                            {teamInvitations[team.id]?.length > 0 && (
                              <div>
                                <h6 className="font-medium mb-3">
                                  Pending Invitations:
                                </h6>
                                <div className="space-y-2">
                                  {teamInvitations[team.id].map(
                                    (invitation) => (
                                      <div
                                        key={invitation.invitationId}
                                        className="flex items-center gap-3 p-2 bg-yellow-50 border border-yellow-200 rounded"
                                      >
                                        <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                                          {invitation.name
                                            ?.charAt(0)
                                            .toUpperCase() ||
                                            invitation.email
                                              .charAt(0)
                                              .toUpperCase()}
                                        </div>
                                        <div className="flex-1">
                                          <p className="font-medium text-sm">
                                            {invitation.name || "No name"}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            {invitation.email}
                                          </p>
                                          <p className="text-xs text-muted-foreground">
                                            Invited by {invitation.invitedBy} on{" "}
                                            {new Date(
                                              invitation.invitedAt,
                                            ).toLocaleDateString()}
                                          </p>
                                        </div>
                                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                                          Pending
                                        </span>
                                      </div>
                                    ),
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Organization Modal */}
      {showCreateOrgModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              Create New Organization
            </h3>
            <div className="space-y-4">
              <Input
                placeholder="Organization name"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createOrganization()}
              />
              <div className="flex space-x-2">
                <Button onClick={createOrganization} className="flex-1">
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateOrgModal(false);
                    setNewOrgName("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New Team</h3>
            <div className="space-y-4">
              <Input
                placeholder="Team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && createTeam()}
              />
              <div className="flex space-x-2">
                <Button onClick={createTeam} className="flex-1">
                  Create
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateTeamModal(false);
                    setNewTeamName("");
                    setSelectedOrgId("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card border rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Invite User to Team</h3>
            <div className="space-y-4">
              <Input
                type="email"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && inviteUser()}
              />
              <div className="flex space-x-2">
                <Button onClick={inviteUser} className="flex-1">
                  Invite
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteEmail("");
                    setSelectedTeamId("");
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
