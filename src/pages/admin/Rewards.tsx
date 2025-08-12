import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Tables } from '@/types/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Gift, Link, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import RewardExcelImport from '@/components/reward_components/RewardExcelImport';
import { v4 as uuidv4 } from 'uuid';

// Assuming you have a types file for Supabase tables
type Reward = Tables<'rewards'>;

// Define the interface for the reward form data
interface RewardFormData {
    id?: string;
    tier: string;
    title: string;
    description: string;
    points_required: number;
    is_active: boolean;
    link: string | null;
    image_url: string | null;
}

// Define the props interface for RewardForm component
interface RewardFormProps {
    onSubmit: (e: React.FormEvent) => void;
    onCancel: () => void;
    isEdit?: boolean;
    formData: RewardFormData;
    setFormData: React.Dispatch<React.SetStateAction<RewardFormData>>;
    imageFile: File | null;
    setImageFile: React.Dispatch<React.SetStateAction<File | null>>;
}

// Tier information function (same as provided)
// const getTierInfo = (totalSold: number): { tier: string; svg: string } => {
//     if (totalSold < 1000) return { tier: "Base", svg: "Base" };
//     if (totalSold < 2000) return { tier: "Bronze", svg: "Bronze" };
//     if (totalSold < 4000) return { tier: "Silver I", svg: "Silver" };
//     if (totalSold < 6000) return { tier: "Silver II", svg: "Silver" };
//     if (totalSold < 10000) return { tier: "Silver III", svg: "Silver" };
//     if (totalSold < 15000) return { tier: "Gold I", svg: "Gold" };
//     if (totalSold < 20000) return { tier: "Gold II", svg: "Gold" };
//     if (totalSold < 26000) return { tier: "Gold III", svg: "Gold" };
//     if (totalSold < 32000) return { tier: "Crystal I", svg: "Crystal" };
//     if (totalSold < 38000) return { tier: "Crystal II", svg: "Crystal" };
//     if (totalSold < 45000) return { tier: "Crystal III", svg: "Crystal" };
//     return { tier: "Diamond", svg: "Diamond" };
// };

const tierOrder = ["Base", "Bronze", "Silver", "Gold", "Crystal", "Diamond"];
const allTiers = [
    "Base", "Bronze", "Silver I", "Silver II", "Silver III",
    "Gold I", "Gold II", "Gold III", "Crystal I", "Crystal II",
    "Crystal III", "Diamond"
];

const getParentTier = (tierName: string) => {
    if (tierName.startsWith("Silver")) return "Silver";
    if (tierName.startsWith("Gold")) return "Gold";
    if (tierName.startsWith("Crystal")) return "Crystal";
    return tierName;
};

const extractRomanNumeral = (tierName: string) => {
    const parts = tierName.split(' ');
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return null;
};

// Reusable component for displaying tier with SVG and numeral
const TierVisual = ({ tierName, showIcon = true }: { tierName: string, showIcon?: boolean }) => {
    const parentTierName = getParentTier(tierName);
    const romanNumeral = extractRomanNumeral(tierName);
    const svgPath = `/tier/${parentTierName}.svg`;

    return (
        <div className="flex items-center gap-2">
            {showIcon && <img src={svgPath} alt={parentTierName} className="w-8 h-8" />}
            <div className="flex flex-col">
                <span>{parentTierName}</span>
                {romanNumeral && <span className="text-xs absolute text-muted-foreground left-14 -bottom-0">{romanNumeral}</span>}
            </div>
        </div>
    );
};

const getTierColor = (tierName: string) => {
    switch (getParentTier(tierName)) {
        case 'Bronze':
            return 'text-amber-600 bg-amber-100 dark:text-amber-300 dark:bg-amber-950';
        case 'Silver':
            return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-950';
        case 'Gold':
            return 'text-yellow-600 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-950';
        case 'Crystal':
            return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-950';
        case 'Diamond':
            return 'text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-950';
        default:
            return 'text-muted-foreground bg-muted';
    }
};

const RewardForm: React.FC<RewardFormProps> = ({ onSubmit, onCancel, isEdit = false, formData, setFormData, imageFile, setImageFile }) => {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (imageFile) {
            const url = URL.createObjectURL(imageFile);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else if (formData.image_url) {
            setPreviewUrl(formData.image_url);
        } else {
            setPreviewUrl(null);
        }
    }, [imageFile, formData.image_url]);

    return (
        <div className="h-[85vh] overflow-auto px-4 py-6">
            <form onSubmit={onSubmit} className="space-y-4 min-h-full p-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Reward Title</Label>
                        <Input
                            id="title"
                            placeholder="e.g., 10% Discount"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="points_required">Points Required</Label>
                        <Input
                            id="points_required"
                            type="number"
                            placeholder="e.g., 500"
                            value={formData.points_required}
                            onChange={(e) => setFormData({ ...formData, points_required: parseInt(e.target.value) || 0 })}
                            required
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="link">Reward Link (Optional)</Label>
                    <Input
                        id="link"
                        type="url"
                        placeholder="https://example.com/reward"
                        value={formData.link || ''}
                        onChange={(e) => setFormData({ ...formData, link: e.target.value || null })}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="image_upload">Reward Image (Optional)</Label>
                    <Input
                        id="image_upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setImageFile(file);
                        }}
                    />
                    <div className="text-center text-muted-foreground text-sm">OR</div>
                    <Input
                        id="image_url"
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={formData.image_url || ''}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value || null })}
                    />
                    <p className="text-xs text-muted-foreground">
                        Upload a file or provide an image URL. URL will be used if both are provided.
                    </p>
                    {previewUrl ? (
                        <div className="border border-input rounded-md p-2 mt-2">
                            <p className="text-sm text-muted-foreground mb-2">Image Preview</p>
                            <img
                                src={previewUrl}
                                alt="Preview"
                                className="w-full h-32 object-contain rounded-md"
                            />
                        </div>
                    ) : (
                        <div className="border border-input rounded-md p-4 mt-2 flex justify-center items-center h-32 bg-muted">
                            <ImageIcon className="w-10 h-10 text-muted-foreground opacity-50" />
                        </div>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="tier">Tier</Label>
                    <Select
                        value={formData.tier}
                        onValueChange={(value) => setFormData({ ...formData, tier: value })}
                    >
                        <SelectTrigger className="w-full">
                            <SelectValue>
                                {formData.tier ? <TierVisual tierName={formData.tier} /> : "Select Tier"}
                            </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                            {allTiers.map(tier => (
                                <SelectItem key={tier} value={tier}>
                                    <TierVisual tierName={tier} />
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                        id="description"
                        placeholder="Enter reward details..."
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        required
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit">
                        {isEdit ? 'Update Reward' : 'Add Reward'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

const Rewards = () => {
    const [rewards, setRewards] = useState<Reward[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingReward, setEditingReward] = useState<Reward | null>(null);
    const [formData, setFormData] = useState<RewardFormData>({
        tier: 'Base',
        title: '',
        description: '',
        points_required: 0,
        is_active: true,
        link: null,
        image_url: null,
    });
    const [imageFile, setImageFile] = useState<File | null>(null);

    const { toast } = useToast();

    const handleBulkImport = async (importedData: any[]) => {
        if (!importedData || importedData.length === 0) {
            toast({
                title: "Error",
                description: "No data found in the imported file.",
                variant: "destructive"
            });
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const rewardData of importedData) {
            try {
                // Validate required fields
                if (!rewardData.title || !rewardData.description) {
                    errorCount++;
                    continue;
                }

                let imageUrl = rewardData.image_url;
                
                // If image_url is provided, use it directly (no need to upload)
                // The user can provide direct image URLs now
                
                const { error } = await supabase.from('rewards').insert([{
                    tier: rewardData.tier || 'Base',
                    title: rewardData.title,
                    description: rewardData.description,
                    points_required: rewardData.points_required || 0,
                    is_active: rewardData.is_active ?? true,
                    link: rewardData.link || null,
                    image_url: imageUrl || null,
                }]);

                if (error) throw error;
                successCount++;
            } catch (error) {
                console.error('Error importing reward:', error);
                errorCount++;
            }
        }

        toast({
            title: "Import Complete",
            description: `Successfully imported ${successCount} rewards. ${errorCount > 0 ? `${errorCount} failed.` : ''}`,
            variant: successCount > 0 ? "default" : "destructive"
        });
    };

    const uploadImage = useCallback(async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `reward-images/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('products')
            .upload(filePath, file);

        if (uploadError) {
            console.error('Image upload failed:', uploadError.message);
            toast({
                title: "Error",
                description: "Failed to upload image.",
                variant: "destructive"
            });
            return null;
        }

        const { data } = supabase.storage
            .from('reward-images')
            .getPublicUrl(filePath);

        return data?.publicUrl || null;
    }, [toast]);

    useEffect(() => {
        fetchRewards();
        const channel = supabase
            .channel('rewards-changes')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'rewards' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setRewards(prev => [...prev, payload.new as Reward].sort((a, b) => a.points_required - b.points_required));
                    } else if (payload.eventType === 'UPDATE') {
                        setRewards(prev => prev.map(r =>
                            r.id === payload.new.id ? payload.new as Reward : r
                        ));
                    } else if (payload.eventType === 'DELETE') {
                        setRewards(prev => prev.filter(r => r.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        // Add event listeners for command palette import/export actions
        const handleExportRewards = () => {
            console.log('🚀 Export Rewards command received from command palette');
            const exportBtn = document.querySelector('[data-command-export-btn]');
            if (exportBtn) (exportBtn as HTMLElement).click();
        };

        const handleImportRewards = () => {
            console.log('🚀 Import Rewards command received from command palette');
            const importBtn = document.querySelector('[data-command-import-btn]');
            if (importBtn) (importBtn as HTMLElement).click();
        };

        window.addEventListener('open-export-reward', handleExportRewards);
        window.addEventListener('open-import-reward', handleImportRewards);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('open-export-reward', handleExportRewards);
            window.removeEventListener('open-import-reward', handleImportRewards);
        };
    }, []);

    const fetchRewards = async () => {
        try {
            const { data, error } = await supabase
                .from('rewards')
                .select('*')
                .order('points_required', { ascending: true });

            if (error) throw error;
            setRewards(data as Reward[]);
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to fetch rewards",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAddReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title || !formData.description) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }

        let imageUrl = formData.image_url;
        
        // Only upload file if no image_url is provided and a file is selected
        if (!imageUrl && imageFile) {
            const uploadedUrl = await uploadImage(imageFile);
            if (!uploadedUrl) return;
            imageUrl = uploadedUrl;
        }

        try {
            const { error } = await supabase.from('rewards').insert([{ ...formData, image_url: imageUrl }]);
            if (error) throw error;

            setIsAddModalOpen(false);
            resetForm();
            toast({
                title: "Success",
                description: "Reward added successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to add reward",
                variant: "destructive"
            });
            console.error('Add reward error:', error);
        }
    };

    const handleEditReward = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingReward || !formData.title || !formData.description) {
            toast({
                title: "Error",
                description: "Please fill in all required fields",
                variant: "destructive"
            });
            return;
        }

        let imageUrl = formData.image_url;
        
        // Only upload file if no image_url is provided and a file is selected
        if (!imageUrl && imageFile) {
            const uploadedUrl = await uploadImage(imageFile);
            if (!uploadedUrl) return;
            imageUrl = uploadedUrl;
        }

        try {
            const { error } = await supabase
                .from('rewards')
                .update({ ...formData, image_url: imageUrl })
                .eq('id', editingReward.id);

            if (error) throw error;

            setIsEditModalOpen(false);
            setEditingReward(null);
            resetForm();
            toast({
                title: "Success",
                description: "Reward updated successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to update reward",
                variant: "destructive"
            });
            console.error('Update reward error:', error);
        }
    };

    const deleteReward = async (id: string) => {
        if (!confirm('Are you sure you want to delete this reward?')) return;

        try {
            const { error } = await supabase.from('rewards').delete().eq('id', id);
            if (error) throw error;

            toast({
                title: "Success",
                description: "Reward deleted successfully"
            });
        } catch (error) {
            toast({
                title: "Error",
                description: "Failed to delete reward",
                variant: "destructive"
            });
            console.error('Delete reward error:', error);
        }
    };

    const openEditModal = (reward: Reward) => {
        setEditingReward(reward);
        setFormData({
            tier: reward.tier,
            title: reward.title,
            description: reward.description,
            points_required: reward.points_required,
            is_active: reward.is_active ?? true,
            link: reward.link,
            image_url: reward.image_url,
        });
        setImageFile(null);
        setIsEditModalOpen(true);
    };

    const resetForm = useCallback(() => {
        setFormData({
            tier: 'Base',
            title: '',
            description: '',
            points_required: 0,
            is_active: true,
            link: null,
            image_url: null,
        });
        setImageFile(null);
    }, []);

    const handleAddCancel = useCallback(() => {
        setIsAddModalOpen(false);
        resetForm();
    }, [resetForm]);

    const handleEditCancel = useCallback(() => {
        setIsEditModalOpen(false);
        setEditingReward(null);
        resetForm();
    }, [resetForm]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
            </div>
        );
    }

    const groupedRewards = tierOrder.reduce((acc, parentTier) => {
        const matchingRewards = rewards.filter(r => getParentTier(r.tier) === parentTier);
        if (matchingRewards.length > 0) {
            acc[parentTier] = matchingRewards.sort((a, b) => a.points_required - b.points_required);
        }
        return acc;
    }, {} as Record<string, Reward[]>);

    return (
        <div className="space-y-6 fade-in-up">
            <div className="healthcare-card">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Rewards Management</h1>
                        <p className="text-muted-foreground mt-1">
                            Create and manage rewards for different loyalty tiers.
                        </p>
                    </div>
                    <div className="flex gap-2 items-center">
                        <RewardExcelImport onDataParsed={handleBulkImport} rewards={rewards} />
                        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-healthcare">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add New Reward
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                    <DialogTitle>Add New Reward</DialogTitle>
                                </DialogHeader>
                                <RewardForm
                                    onSubmit={handleAddReward}
                                    onCancel={handleAddCancel}
                                    formData={formData}
                                    setFormData={setFormData}
                                    imageFile={imageFile}
                                    setImageFile={setImageFile}
                                />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </div>

            {Object.keys(groupedRewards).length > 0 ? (
                tierOrder.map(parentTier => {
                    const rewardsInTier = groupedRewards[parentTier];
                    if (!rewardsInTier) return null;

                    const parentTierSvg = `/tier/${parentTier}.svg`;
                    const tierDescription: Record<string, string> = {
                        "Base": "Basic rewards for starting members.",
                        "Bronze": "Rewards for dedicated members.",
                        "Silver": "Exclusive rewards for our valued members.",
                        "Gold": "Premium rewards for our top members.",
                        "Crystal": "Elite rewards for our most loyal members.",
                        "Diamond": "The ultimate rewards for our best members.",
                    };

                    return (
                        <div key={parentTier} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <span className={`p-2 rounded-full ${getTierColor(parentTier)} bg-opacity-20`}>
                                    <img src={parentTierSvg} alt={parentTier} className="w-10 h-10" />
                                </span>
                                <div>
                                    <h2 className="text-2xl font-bold">{parentTier} Rewards</h2>
                                    <p className="text-muted-foreground">{tierDescription[parentTier]}</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {rewardsInTier.map((reward) => (
                                    <Card key={reward.id} className="healthcare-card flex flex-col">
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex items-start justify-between gap-2">
                                                <CardTitle className="text-lg font-semibold">{reward.title}</CardTitle>
                                                <Badge className="text-sm shrink-0">
                                                    {reward.points_required} Points
                                                </Badge>
                                            </div>
                                            <div className={`p-2 ${getTierColor(reward.tier)} rounded-md`}>
                                                <TierVisual tierName={reward.tier} />
                                            </div>
                                        </CardHeader>
                                        <div className="p-4 pt-0">
                                            {reward.image_url ? (
                                                <img
                                                    src={reward.image_url}
                                                    alt={reward.title}
                                                    className="w-full h-40 object-contain rounded-md mt-2 mb-2 border border-muted"
                                                />
                                            ) : (
                                                <div className="w-full h-40 flex flex-col items-center justify-center bg-muted rounded-md mt-2 mb-2">
                                                    <img src={`/${getParentTier(reward.tier)}.svg`} alt={getParentTier(reward.tier)} className="w-16 h-16 text-muted-foreground mb-2" />
                                                    {extractRomanNumeral(reward.tier) && <span className="text-sm text-muted-foreground font-medium">{extractRomanNumeral(reward.tier)}</span>}
                                                </div>
                                            )}
                                            <p className="text-sm text-muted-foreground line-clamp-3">
                                                {reward.description}
                                            </p>
                                        </div>

                                        <div className="p-4 pt-0 flex gap-2 mt-2">
                                            {reward.link && (
                                                <Button
                                                    asChild
                                                    variant="default"
                                                    size="sm"
                                                    className="flex-1"
                                                >
                                                    <a href={reward.link} target="_blank" rel="noopener noreferrer">
                                                        <Link className="w-4 h-4 mr-2" />
                                                        Claim Reward
                                                    </a>
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => openEditModal(reward)}
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
                                                onClick={() => deleteReward(reward.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    );
                })
            ) : (
                <Card className="healthcare-card">
                    <CardContent className="pt-6">
                        <div className="text-center py-8">
                            <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <h3 className="text-lg font-medium text-foreground mb-2">No rewards found</h3>
                            <p className="text-muted-foreground mb-4">
                                Add your first reward to get started.
                            </p>
                            <Button className="btn-healthcare" onClick={() => setIsAddModalOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add New Reward
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Reward</DialogTitle>
                    </DialogHeader>
                    <RewardForm
                        onSubmit={handleEditReward}
                        onCancel={handleEditCancel}
                        isEdit
                        formData={formData}
                        setFormData={setFormData}
                        imageFile={imageFile}
                        setImageFile={setImageFile}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Rewards;