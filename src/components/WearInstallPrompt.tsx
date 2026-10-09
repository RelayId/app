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
            message="A compatible Wear OS device is connected. Open the signed watch download if RelayId is missing or needs an update. Android and the watch will ask for installation confirmation."
            actions={[
                { label: 'Later', onPress: onLater },
                { label: 'Open watch download', onPress: onOpen },
            ]}
        />
    );
}
