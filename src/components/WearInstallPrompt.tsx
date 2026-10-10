import { FeedbackModal } from './FeedbackModal';
import type { UpdateArtifact } from '../relay/updates';

export type WearInstallPromptProps = {
    artifact?: UpdateArtifact;
    onLater: () => void;
    onOpen: () => void;
};

export function WearInstallPrompt({ artifact, onLater, onOpen }: WearInstallPromptProps) {
    return (
        <FeedbackModal
            visible={artifact !== undefined}
            title="RelayId is available for your watch"
            message="A compatible Wear OS device is connected, but RelayId Watch is not installed on every connected watch. Manage installation from Settings."
            actions={[
                { label: 'Later', onPress: onLater },
                { label: 'Open Watch center', onPress: onOpen },
            ]}
        />
    );
}
