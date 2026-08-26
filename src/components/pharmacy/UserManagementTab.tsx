import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Loader2,
  ShieldCheck,
  UserRound,
  Trash2,
  RefreshCw,
  Mail,
} from "lucide-react";
import { toast } from "sonner";

interface PharmacyUser {
  id: string;
  email: string;
  name: string;
  role: "admin" | "pharmacist";
  created_at: string;
}

export function UserManagementTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<PharmacyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // New user form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "pharmacist">("pharmacist");
  const [creating, setCreating] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch profiles joined with auth users via admin API
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // We also need email — store email in profiles if available, 
      // or we use a different approach below
      setUsers(
        (data ?? []).map((p: any) => ({
          id: p.id,
          email: p.email ?? "",
          name: p.name ?? "",
          role: p.role,
          created_at: p.created_at,
        }))
      );
    } catch (err: any) {
      toast.error("Failed to load users: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) {
      toast.error("All fields are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setCreating(true);
    try {
      // Sign up the new user using Supabase Auth
      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email: newEmail,
          password: newPassword,
          options: {
            data: { full_name: newName },
          },
        });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Failed to create user");

      // The trigger creates a profile with role='admin' by default.
      // We now update the role to the selected one.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: newRole, name: newName })
        .eq("id", signUpData.user.id);

      if (profileError) throw profileError;

      toast.success(
        `${newName} created as ${newRole}. They will receive a confirmation email at ${newEmail}.`
      );
      setShowCreate(false);
      setNewEmail("");
      setNewPassword("");
      setNewName("");
      setNewRole("pharmacist");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const changeRole = async (userId: string, role: "admin" | "pharmacist") => {
    if (userId === currentUser?.id) {
      toast.error("You cannot change your own role");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", userId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    toast.success("Role updated");
  };

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage pharmacy staff accounts and access roles
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-1.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <UserRound className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No users found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Add pharmacy staff using the button above.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                      u.role === "admin"
                        ? "bg-brand-red/10 text-brand-red"
                        : "bg-brand-blue/10 text-brand-blue"
                    }`}
                  >
                    {u.role === "admin" ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <UserRound className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {u.name || "—"}
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="text-[10px] py-0">
                          You
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {u.email || u.id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={`capitalize ${
                      u.role === "admin"
                        ? "bg-brand-red/10 text-brand-red border-brand-red/20"
                        : "bg-brand-blue/10 text-brand-blue border-brand-blue/20"
                    }`}
                    variant="outline"
                  >
                    {u.role}
                  </Badge>
                  {u.id !== currentUser?.id && (
                    <Select
                      value={u.role}
                      onValueChange={(v) =>
                        changeRole(u.id, v as "admin" | "pharmacist")
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Create Pharmacy User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="new-name">Full Name</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Aswin Kumar"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@hospital.com"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-password">Temporary Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min. 6 characters"
                className="h-10 mt-1"
              />
            </div>
            <div>
              <Label htmlFor="new-role">Role</Label>
              <Select
                value={newRole}
                onValueChange={(v) => setNewRole(v as "admin" | "pharmacist")}
              >
                <SelectTrigger id="new-role" className="h-10 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pharmacist">
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4 text-brand-blue" /> Pharmacist
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-brand-red" /> Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={createUser} disabled={creating}>
              {creating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</>
              ) : (
                <><UserPlus className="h-4 w-4 mr-2" /> Create User</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
