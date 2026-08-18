-- 품질개선프로젝트: 문제 등록 → 가설/실험/관찰/결정 노드 트리 → 이슈 연결
CREATE TABLE IF NOT EXISTS problems (
  problem_id   INT AUTO_INCREMENT PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  background   TEXT         NULL,
  state        VARCHAR(20)  NOT NULL DEFAULT 'open',   -- open / closed
  status       VARCHAR(20)  NOT NULL DEFAULT 'active', -- soft delete
  created_by   VARCHAR(40)  NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_state  (state),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS problem_steps (
  step_id         INT AUTO_INCREMENT PRIMARY KEY,
  problem_id      INT NOT NULL,
  parent_step_id  INT NULL,
  kind            VARCHAR(20)  NOT NULL,  -- hypothesis / experiment / observation / decision
  title           VARCHAR(200) NOT NULL,
  body            TEXT         NULL,
  result_status   VARCHAR(20)  NULL,      -- planned / running / success / fail / partial / inconclusive
  expected_result TEXT         NULL,
  actual_result   TEXT         NULL,
  position_x      FLOAT        NULL,
  position_y      FLOAT        NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_problem (problem_id, status),
  INDEX idx_parent  (parent_step_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS problem_issues (
  problem_id  INT NOT NULL,
  issue_id    INT NOT NULL,
  linked_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  linked_by   VARCHAR(40) NULL,
  PRIMARY KEY (problem_id, issue_id),
  INDEX idx_issue (issue_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
