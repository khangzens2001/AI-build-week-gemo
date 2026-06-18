import hashlib
import json
import os
import shutil
from datetime import datetime
import config

class ChangeDetector:
    def __init__(self):
        self.latest_dir = config.LATEST_DIR
        self.history_dir = config.HISTORY_DIR

    def compute_hash(self, data: dict) -> str:
        """Compute SHA-256 hash of a dictionary."""
        # Convert to string and sort keys for consistent hashing
        json_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(json_str.encode('utf-8')).hexdigest()

    def get_latest_data(self, page_name: str) -> dict:
        """Retrieve the most recently saved data for a page."""
        filepath = os.path.join(self.latest_dir, f"{page_name}.json")
        if not os.path.exists(filepath):
            return {}
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading {filepath}: {e}")
            return {}

    def process_and_save(self, page_name: str, new_data: dict) -> bool:
        """
        Compare new data with latest data.
        If changed, move old latest to history, save new to latest.
        Returns True if changed, False otherwise.
        """
        new_hash = self.compute_hash(new_data)
        new_data['content_hash'] = new_hash
        new_data['scraped_at'] = datetime.now().isoformat()

        latest_data = self.get_latest_data(page_name)
        old_hash = latest_data.get('content_hash', '')

        if new_hash == old_hash:
            return False  # No changes

        # It's a new scrape or there are changes
        latest_filepath = os.path.join(self.latest_dir, f"{page_name}.json")
        
        # Move current latest to history if it exists
        if os.path.exists(latest_filepath):
            timestamp = datetime.fromisoformat(latest_data['scraped_at']).strftime("%Y%m%dT%H%M%S")
            history_folder = os.path.join(self.history_dir, timestamp)
            os.makedirs(history_folder, exist_ok=True)
            history_filepath = os.path.join(history_folder, f"{page_name}.json")
            shutil.copy2(latest_filepath, history_filepath)

        # Save new data to latest
        with open(latest_filepath, 'w', encoding='utf-8') as f:
            json.dump(new_data, f, ensure_ascii=False, indent=2)
            
        return True
