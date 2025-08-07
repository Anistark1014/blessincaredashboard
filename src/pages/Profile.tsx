import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UserProfile {
  name: string;
  email: string;
  region: string;
  role: string;
  reward_points: number;
  due_balance: number;
  total_revenue_generated: number;
  coverage: number;
}

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<UserProfile>({
    name: "",
    email: "",
    region: "",
    role: "",
    reward_points: 0,
    due_balance: 0,
    total_revenue_generated: 0,
    coverage: 0,
  });

  // Fetch user profile on mount
  useEffect(() => {
    async function fetchUserProfile() {
      setLoading(true);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        alert("Failed to get user");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        alert("Failed to load user profile");
        setLoading(false);
        return;
      }

      setFormData({
        name: data.name || "",
        email: data.email || "",
        region: data.region || "",
        role: data.role,
        reward_points: data.reward_points,
        due_balance: data.due_balance,
        total_revenue_generated: data.total_revenue_generated,
        coverage: data.coverage,
      });

      setLoading(false);
    }

    fetchUserProfile();
  }, []);

  // Handle profile update
  const handleUpdate = async () => {
    setIsSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        alert("Failed to get session.");
        setIsSaving(false);
        return;
      }

      const token = session.access_token;

      const res = await fetch(
        "https://virbnugthhbunxxxsizw.supabase.co/functions/v1/edit-profile", // TODO: Replace with actual URL
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            updates: {
              name: formData.name,
              email: formData.email,
              region: formData.region,
            },
          }),
        }
      );

      const result = await res.json();

      if (res.ok) {
        alert("Profile updated successfully!");
      } else {
        console.error(result);
        alert("Update failed: " + (result.message || "Unknown error"));
      }
    } catch (error) {
      console.error(error);
      alert("Something went wrong while updating.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading profile...</div>;

  return (
    <div className="max-w-xl mx-auto p-6 shadow rounded mt-8">
      <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>

      {/* Editable Fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Name</label>
          <input
            type="text"
            className="mt-1 block w-full border rounded px-3 py-2"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            className="mt-1 block w-full border rounded px-3 py-2"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Region</label>
          <input
            type="text"
            className="mt-1 block w-full border rounded px-3 py-2"
            value={formData.region}
            onChange={(e) =>
              setFormData({ ...formData, region: e.target.value })
            }
          />
        </div>
      </div>

      {/* Read-Only Fields */}
      <div className="mt-6 border-t pt-4 text-sm text-gray-700 space-y-2">
        <div>
          <strong>Role:</strong> {formData.role}
        </div>
        <div>
          <strong>Reward Points:</strong> {formData.reward_points}
        </div>
        <div>
          <strong>Due Balance:</strong> ₹{formData.due_balance}
        </div>
        <div>
          <strong>Total Revenue:</strong> ₹{formData.total_revenue_generated}
        </div>
        <div>
          <strong>Coverage:</strong> {formData.coverage}
        </div>
      </div>

      <button
        onClick={handleUpdate}
        disabled={isSaving}
        className="mt-6 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}
