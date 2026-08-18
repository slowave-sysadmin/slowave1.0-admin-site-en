"use client";

export default function ManualPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-text-primary">사용 매뉴얼</h1>

      <div className="bg-bg-card rounded-lg border border-border-primary p-6 shadow-sm space-y-8">
        {/* 역할 및 권한 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-4">역할 및 권한</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border-primary rounded-lg">
              <thead>
                <tr className="bg-bg-tertiary text-text-secondary">
                  <th className="px-4 py-2.5 text-left font-medium border-b border-border-primary">기능</th>
                  <th className="px-4 py-2.5 text-center font-medium border-b border-border-primary">시스템관리자</th>
                  <th className="px-4 py-2.5 text-center font-medium border-b border-border-primary">관리자</th>
                  <th className="px-4 py-2.5 text-center font-medium border-b border-border-primary">멤버</th>
                </tr>
              </thead>
              <tbody className="text-text-primary">
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">대시보드</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">기관 / 사용자 / 센서 관리</td>
                  <td className="px-4 py-2 text-center">조회 + 편집</td>
                  <td className="px-4 py-2 text-center">조회 + 편집</td>
                  <td className="px-4 py-2 text-center">조회만 (허용 시)</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">검사 조회</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">허용 시</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">분석 실패 관리</td>
                  <td className="px-4 py-2 text-center">검토 + 상태 변경</td>
                  <td className="px-4 py-2 text-center">검토 + 상태 변경</td>
                  <td className="px-4 py-2 text-center">조회만 (허용 시)</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">실패 원인 / 조치 유형 관리</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">X</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">센서 이력</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">조회만 (허용 시)</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">센서 이슈 메모 등록</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">로그 조회</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">허용 시</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">기능 관리 (목록)</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O (조회만)</td>
                  <td className="px-4 py-2 text-center">허용 시 (조회만)</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">기능 추가 / 수정</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">X</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">기관별 기능 설정</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">관리자 계정 추가 / 삭제</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">O (시스템관리자 제외)</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr className="border-b border-border-secondary">
                  <td className="px-4 py-2 font-medium">시스템관리자 역할 부여 / 수정</td>
                  <td className="px-4 py-2 text-center">O</td>
                  <td className="px-4 py-2 text-center">X</td>
                  <td className="px-4 py-2 text-center">X</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">지원 요청</td>
                  <td className="px-4 py-2 text-center">등록 + 답변</td>
                  <td className="px-4 py-2 text-center">등록 + 답변</td>
                  <td className="px-4 py-2 text-center">등록만 (허용 시)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 역할 설명 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">역할 설명</h2>
          <div className="space-y-3">
            <div className="p-3 rounded-lg bg-bg-tertiary">
              <p className="text-sm font-medium text-text-primary">시스템관리자 (system_admin)</p>
              <p className="text-xs text-text-secondary mt-1">모든 기능에 대한 전체 접근 권한. 관리자 계정 관리, 기능 추가/수정, 역할 변경, 실패 원인/조치 유형 관리가 가능합니다.</p>
            </div>
            <div className="p-3 rounded-lg bg-bg-tertiary">
              <p className="text-sm font-medium text-text-primary">관리자 (admin)</p>
              <p className="text-xs text-text-secondary mt-1">대부분의 관리 기능 사용 가능. 관리자 계정 추가/삭제 가능하나, 시스템관리자 계정은 수정/삭제할 수 없습니다. 분석 실패 검토 및 상태 변경, 센서 이슈 메모 등록이 가능합니다.</p>
            </div>
            <div className="p-3 rounded-lg bg-bg-tertiary">
              <p className="text-sm font-medium text-text-primary">멤버 (member)</p>
              <p className="text-xs text-text-secondary mt-1">관리자가 지정한 페이지만 접근 가능합니다. 접근 가능한 페이지에서도 데이터 조회만 가능하며, 추가/수정/삭제는 할 수 없습니다.</p>
            </div>
          </div>
        </section>

        {/* 분석 실패 관리 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">분석 실패 관리</h2>
          <div className="text-sm text-text-secondary space-y-2">
            <p>검사의 분석 상태가 <span className="font-medium text-red-500">analyze_failed</span> 또는 <span className="font-medium text-amber-500">report_failed</span>인 건이 자동으로 표시됩니다.</p>
            <p>엔지니어가 실패 원인과 조치를 기록하면 <span className="font-medium text-text-primary">검토됨</span>으로 표시되며, 해결 후에도 이력으로 유지됩니다.</p>
            <p>수동으로 레포트를 재생성한 경우, 상세 모달에서 분석 상태를 <span className="font-medium text-green-600">report_generated</span>로 변경할 수 있습니다. 이때 실패 원인과 조치는 필수 입력입니다.</p>
          </div>
        </section>

        {/* 센서 이력 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">센서 이력</h2>
          <div className="text-sm text-text-secondary space-y-2">
            <p><span className="font-medium text-text-primary">센서 관리</span> 페이지에서 관리 &gt; 센서 이력을 선택하면, 해당 센서의 전체 생애를 확인할 수 있습니다.</p>
            <p><span className="font-medium text-text-primary">검사 이력</span> — 해당 센서로 수행된 모든 검사 목록. 분석 실패 건은 빨간 배경으로 강조되며, 원인/조치 코멘트가 함께 표시됩니다.</p>
            <p><span className="font-medium text-text-primary">기관 이동</span> — 센서가 소속 기관이 변경된 이력을 시간순으로 표시합니다.</p>
            <p><span className="font-medium text-text-primary">이슈 메모</span> — 검사와 무관한 센서 자체 이슈(하드웨어 결함, 캘리브레이션 등)를 수동으로 등록하고 관리합니다.</p>
            <p>센서 목록의 <span className="font-medium text-text-primary">실패</span> 컬럼에서 실패 건수를 클릭하면 바로 센서 이력을 확인할 수 있습니다.</p>
          </div>
        </section>

        {/* 특수 기능 설정 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">특수 기능 설정</h2>
          <div className="text-sm text-text-secondary space-y-2">
            <p>특수 기능은 기관별로 활성화/비활성화할 수 있는 선택적 기능입니다.</p>
            <p><span className="font-medium text-text-primary">기능 관리</span> 페이지에서 전체 기능 목록을 확인하고, 시스템관리자는 새 기능을 추가하거나 수정할 수 있습니다.</p>
            <p><span className="font-medium text-text-primary">기관 관리</span> 페이지에서 관리 &gt; 특수기능 설정을 선택하면, 해당 기관에 기능을 켜거나 끌 수 있습니다.</p>
          </div>
        </section>

        {/* 지원 요청 */}
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">지원 요청</h2>
          <div className="text-sm text-text-secondary space-y-2">
            <p>오류 신고, 기능 요청, 문의를 등록할 수 있습니다. 모든 역할에서 등록 가능합니다.</p>
            <p>관리자와 시스템관리자는 지원 요청에 답변을 작성하고 상태(접수/처리 중/완료)를 변경할 수 있습니다.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
