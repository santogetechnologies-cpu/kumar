import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { usePharmacy } from "@/lib/pharmacy-store";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  UserPlus,
  Loader2,
  ShieldCheck,
  UserRound,
  Trash2,
  RefreshCw,
  Mail,
  KeyRound,
  Stethoscope,
  Settings2,
  Lock
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
  const { doctors, addDoctor, deleteDoctor, toggleDoctor, canTransfer, updateSetting } = usePharmacy();
  const [users, setUsers] = useState<PharmacyUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Create user
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "pharmacist">("pharmacist");
  const [creating, setCreating] = useState(false);

  // Change password
  const [pwUser, setPwUser] = useState<PharmacyUser | null>(null);
  const [newPw, setNewPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  // Delete user
  const [deleteTarget, setDeleteTarget] = useState<PharmacyUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Doctor
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const [newDoctorName, setNewDoctorName] = useState("");
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState("");
  const [addingDoctor, setAddingDoctor] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
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

  useEffect(() => { fetchUsers(); }, []);

  /* ---- Create User ---- */
  const createUser = async () => {
    if (!newEmail || !newPassword || !newName) { toast.error("All fields are required"); return; }
    if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setCreating(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newEmail,
        password: newPassword,
        options: { data: { full_name: newName } },
      });
      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error("Failed to create user");

      // Update role & email (trigger sets default 'admin', override here)
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ role: newRole, name: newName, email: newEmail })
        .eq("id", signUpData.user.id);
      if (profileError) throw profileError;

      toast.success(`${newName} created as ${newRole}. A confirmation email was sent to ${newEmail}.`);
      setShowCreate(false);
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("pharmacist");
      await fetchUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  /* ---- Change Role ---- */
  const changeRole = async (userId: string, role: "admin" | "pharmacist") => {
    if (userId === currentUser?.id) { toast.error("You cannot change your own role"); return; }
    const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
    if (error) { toast.error(error.message); return; }
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
    toast.success("Role updated");
  };

  /* ---- Change Password (current user only via Supabase Auth) ---- */
  const handleChangePassword = async () => {
    if (!newPw || newPw.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!pwUser) return;

    setChangingPw(true);
    try {
      if (pwUser.id === currentUser?.id) {
        // Change own password
        const { error } = await supabase.auth.updateUser({ password: newPw });
        if (error) throw error;
        toast.success("Password updated successfully");
      } else {
        // For other users: admin must use Supabase Admin API (requires service key)
        // We'll use an Edge Function or direct admin endpoint
        // Since we only have anon key, we update via a workaround: 
        // Store a reset_password flag in profiles, then email them
        const { error } = await supabase.auth.resetPasswordForEmail(pwUser.email, {
          redirectTo: window.location.origin + "/login",
        });
        if (error) throw error;
        toast.success(`Password reset email sent to ${pwUser.email}`);
      }
      setPwUser(null);
      setNewPw("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPw(false);
    }
  };

  /* ---- Delete User ---- */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) { toast.error("You cannot delete your own account"); return; }
    setDeleting(true);
    try {
      // Delete profile (auth user deletion requires admin API, we delete profile only)
      const { error } = await supabase.from("profiles").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      toast.success(`${deleteTarget.name || deleteTarget.email} removed`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  /* ---- Doctors ---- */
  const handleAddDoctor = async () => {
    if (!newDoctorName) return toast.error("Doctor name is required");
    setAddingDoctor(true);
    try {
      await addDoctor({ name: newDoctorName, specialty: newDoctorSpecialty });
      toast.success("Doctor added");
      setShowAddDoctor(false);
      setNewDoctorName("");
      setNewDoctorSpecialty("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAddingDoctor(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">User Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage pharmacy staff accounts and access roles</p>
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

      {/* Users List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <Card className="p-12 text-center">
          <UserRound className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">No users found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Add pharmacy staff using the button above.</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {users.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${u.role === "admin" ? "bg-brand-red/10 text-brand-red" : "bg-brand-blue/10 text-brand-blue"}`}>
                    {u.role === "admin" ? <ShieldCheck className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
                  </div>
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {u.name || "—"}
                      {u.id === currentUser?.id && (
                        <Badge variant="outline" className="text-[10px] py-0">You</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {u.email || u.id}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    className={`capitalize ${u.role === "admin" ? "bg-brand-red/10 text-brand-red border-brand-red/20" : "bg-brand-blue/10 text-brand-blue border-brand-blue/20"}`}
                    variant="outline"
                  >
                    {u.role}
                  </Badge>
                  {u.id !== currentUser?.id && (
                    <Select value={u.role} onValueChange={(v) => changeRole(u.id, v as "admin" | "pharmacist")}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="pharmacist">Pharmacist</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => { setPwUser(u); setNewPw(""); }}
                  >
                    <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                    {u.id === currentUser?.id ? "Change Password" : "Reset Password"}
                  </Button>
                  {u.id !== currentUser?.id && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDeleteTarget(u)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Settings / Permissions */}
      <div className="pt-6 border-t mt-8">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4"><Settings2 className="h-5 w-5" /> Global Settings & Permissions</h3>
        <Card className="p-5 flex items-center justify-between">
          <div>
            <h4 className="font-semibold flex items-center gap-2">Allow Pharmacists to Transfer Stock</h4>
            <p className="text-sm text-muted-foreground mt-1">If enabled, pharmacists can move stock from main inventory to pharmacy.</p>
          </div>
          <Button
            variant={canTransfer ? "default" : "secondary"}
            onClick={() => updateSetting("allow_pharmacist_transfer", canTransfer ? "false" : "true")}
          >
            {canTransfer ? <Lock className="h-4 w-4 mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
            {canTransfer ? "Disable Transfer" : "Enable Transfer"}
          </Button>
        </Card>
      </div>

      {/* Doctor Management */}
      <div className="pt-6 border-t mt-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2"><Stethoscope className="h-5 w-5" /> Doctor Management</h3>
            <p className="text-sm text-muted-foreground mt-0.5">Manage doctors available in prescription dispensing</p>
          </div>
          <Button size="sm" onClick={() => setShowAddDoctor(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" /> Add Doctor
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {doctors.map(d => (
            <Card key={d.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.specialty || "No specialty"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleDoctor(d.id, !d.active)}>
                  {d.active ? "Active" : "Inactive"}
                </Button>
                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteDoctor(d.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
          {doctors.length === 0 && (
            <div className="col-span-full text-center py-6 text-muted-foreground text-sm border rounded-xl border-dashed">
              No doctors configured
            </div>
          )}
        </div>
      </div>

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
              <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Aswin Kumar" className="h-10 mt-1" />
            </div>
            <div>
              <Label htmlFor="new-email">Email</Label>
              <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@hospital.com" className="h-10 mt-1" />
            </div>
            <div>
              <Label htmlFor="new-password">Temporary Password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 6 characters" className="h-10 mt-1" />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "pharmacist")}>
                <SelectTrigger className="h-10 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pharmacist">
                    <div className="flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-blue" /> Pharmacist</div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-brand-red" /> Admin</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={createUser} disabled={creating}>
              {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating…</> : <><UserPlus className="h-4 w-4 mr-2" /> Create User</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change / Reset Password Dialog */}
      <Dialog open={!!pwUser} onOpenChange={(o) => { if (!o) { setPwUser(null); setNewPw(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              {pwUser?.id === currentUser?.id ? "Change Your Password" : `Reset Password — ${pwUser?.name || pwUser?.email}`}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-3">
            {pwUser?.id === currentUser?.id ? (
              <div>
                <Label htmlFor="new-pw">New Password</Label>
                <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min. 6 characters" className="h-10 mt-1" />
              </div>
            ) : (
              <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                <p>A <strong>password reset email</strong> will be sent to <strong>{pwUser?.email}</strong>.</p>
                <p className="mt-1">The user can follow the link to set a new password.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPwUser(null); setNewPw(""); }}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={changingPw}>
              {changingPw
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
                : pwUser?.id === currentUser?.id ? "Update Password" : "Send Reset Email"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteTarget?.name || deleteTarget?.email}</strong> from the system?
              Their profile will be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Removing…</> : <><Trash2 className="h-4 w-4 mr-2" /> Remove User</>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Add Doctor Dialog */}
      <Dialog open={showAddDoctor} onOpenChange={setShowAddDoctor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Doctor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Doctor Name</Label>
              <Input value={newDoctorName} onChange={e => setNewDoctorName(e.target.value)} placeholder="Dr. Smith" className="h-10 mt-1" />
            </div>
            <div>
              <Label>Specialty (Optional)</Label>
              <Input value={newDoctorSpecialty} onChange={e => setNewDoctorSpecialty(e.target.value)} placeholder="Cardiology" className="h-10 mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDoctor(false)}>Cancel</Button>
            <Button onClick={handleAddDoctor} disabled={addingDoctor}>
              {addingDoctor ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Add Doctor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
