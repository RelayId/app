import { FeedbackModal } from './FeedbackModal';
import type { AvailableUpdate } from '../relay/updates';

export type UpdatePromptProps = {
    update?: AvailableUpdate;
    onLater: () => void;
    onUpdate: () => void;
};

export function UpdatePrompt({ update, onLater, onUpdate }: UpdatePromptProps) {
    return (
        <FeedbackModal
            visible={update !== undefined}
            title={update ? `RelayId ${update.versionName} is available` : ''}
            message={
                update
                    ? 'Download the signed update from RelayId. Android will ask you to confirm the installation; RelayId will not install it silently.'
                    : undefined
            }
            actions={
                update?.mandatory
                    ? [{ label: 'Download update', onPress: onUpdate }]
                    : [
                          { label: 'Later', onPress: onLater },
                          { label: 'Download update', onPress: onUpdate },
                      ]
            }
        />
    );
}
