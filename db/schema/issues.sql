-- 이슈 원장 (엑셀 VOC/문제 접수 이관)
CREATE TABLE IF NOT EXISTS issues (
  issue_id          INT AUTO_INCREMENT PRIMARY KEY,
  issue_no          INT NOT NULL UNIQUE,
  reporter          VARCHAR(40)  NULL,
  received_at       DATE         NULL,
  problem_type      VARCHAR(40)  NULL,
  voc               TEXT         NULL,
  response_stage    VARCHAR(20)  NULL,
  assignee          VARCHAR(80)  NULL,
  customer_org      VARCHAR(100) NULL,
  product_type      VARCHAR(20)  NULL,
  product_used      TEXT         NULL,
  firmware_ver      VARCHAR(40)  NULL,
  occurred_at       DATE         NULL,
  end_user          VARCHAR(200) NULL,
  test_id           VARCHAR(20)  NULL,
  recovered_at      DATE         NULL,
  problem_check     TEXT         NULL,
  root_cause        TEXT         NULL,
  action_date       DATE         NULL,
  customer_response TEXT         NULL,
  status            VARCHAR(20)  NOT NULL DEFAULT 'active',
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_received     (received_at),
  INDEX idx_test         (test_id),
  INDEX idx_problem_type (problem_type),
  INDEX idx_stage        (response_stage),
  INDEX idx_status       (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS issue_attachments (
  attachment_id INT AUTO_INCREMENT PRIMARY KEY,
  issue_id      INT          NOT NULL,
  file_name     VARCHAR(200) NULL,
  s3_key        VARCHAR(300) NOT NULL,
  mime_type     VARCHAR(80)  NULL,
  size_bytes    INT          NULL,
  uploaded_by   VARCHAR(40)  NULL,
  uploaded_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status        VARCHAR(20)  NOT NULL DEFAULT 'active',
  INDEX idx_issue (issue_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
