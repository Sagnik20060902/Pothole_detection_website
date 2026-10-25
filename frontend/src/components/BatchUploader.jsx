import React from 'react';
import ConnectionHubModal from './ConnectionHubModal';

/**
 * Backward compatibility wrapper for ConnectionHubModal.
 */
export default function BatchUploader(props) {
  return <ConnectionHubModal {...props} />;
}
