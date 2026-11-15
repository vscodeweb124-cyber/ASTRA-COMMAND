CREATE DATABASE IF NOT EXISTS astra_command
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE astra_command;

CREATE TABLE IF NOT EXISTS astra_command_missions (
  id CHAR(36) PRIMARY KEY,
  destination VARCHAR(12) NOT NULL,
  player_name VARCHAR(32) NOT NULL,
  state_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX mission_history (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS astra_command_mission_decisions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  mission_id CHAR(36) NOT NULL,
  scenario_id VARCHAR(40) NOT NULL,
  choice_id VARCHAR(40) NOT NULL,
  explanation VARCHAR(500) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX decision_history (mission_id),
  CONSTRAINT fk_astra_decision_mission FOREIGN KEY (mission_id) REFERENCES astra_command_missions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
