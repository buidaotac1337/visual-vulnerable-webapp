/** Category grouping for entries in the beginner security glossary. */
export type GlossaryCategory = 'workspace' | 'vulnerability' | 'defense';

/** Single beginner-friendly glossary entry displayed in the VVWA glossary modal. */
export interface GlossaryEntry {
  id: string;
  term: string;
  category: GlossaryCategory;
  shortMeaning: string;
  analogy: string;
  tip?: string;
}

/** Core beginner security & workspace glossary (~18 essential terms). */
export const SECURITY_GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'vulnerable-secure',
    term: 'Vulnerable / Secure',
    category: 'workspace',
    shortMeaning:
      'Hai chế độ chạy của MiniShop: Vulnerable chạy code đang có lỗ hổng, còn Secure chạy bản đã vá chuẩn.',
    analogy:
      'Giống như xem bản nháp bị dột nước (Vulnerable) để hiểu nguyên nhân trước khi so sánh với mái nhà đã chống thấm (Secure).',
    tip: 'Nút Test My Fix luôn chấm bài bạn sửa trong file vulnerable.*, không chấm file secure.*.',
  },
  {
    id: 'payload',
    term: 'Payload (Dữ liệu thử / Khai thác)',
    category: 'workspace',
    shortMeaning:
      'Chuỗi dữ liệu đầu vào dùng để gửi lên ứng dụng nhằm kiểm tra luồng bình thường hoặc kích hoạt lỗ hổng.',
    analogy:
      'Giống như chiếc chìa khóa thử hoặc câu chữ đặc biệt bạn nhập vào biểu mẫu để xem hệ thống phản ứng ra sao.',
    tip: 'Bấm các chip Payload mẫu để điền nhanh dữ liệu thử mà không cần nhớ cú pháp.',
  },
  {
    id: 'trace',
    term: 'Trace (Dấu vết thực thi)',
    category: 'workspace',
    shortMeaning:
      'Chuỗi từng bước ghi lại dữ liệu đi từ giao diện MiniShop qua FastAPI tới PostgreSQL và dòng code tương ứng.',
    analogy:
      'Giống như quay chậm đường đi của bức thư qua từng phòng ban để biết nó bị đọc sai ở khâu nào.',
  },
  {
    id: 'diff',
    term: 'Diff (So sánh bản vá)',
    category: 'workspace',
    shortMeaning:
      'Chế độ hiển thị những dòng code khác nhau giữa phiên bản lỗi (vulnerable) và phiên bản an toàn (secure).',
    analogy: 'Giống như dùng bút dạ quang đánh dấu những chỗ đã sửa giữa hai bản hợp đồng.',
  },
  {
    id: 'session-actor',
    term: 'Session & Actor (Phiên & Người dùng)',
    category: 'workspace',
    shortMeaning:
      'Danh tính người dùng đang đăng nhập (như alice, bob, admin) do server xác định từ phiên làm việc.',
    analogy:
      'Giống như thẻ nhân viên do bảo vệ cấp khi vào cổng — server phải tin vào thẻ này chứ không tin lời tự khai.',
  },
  {
    id: 'sandbox-reset',
    term: 'Reset DB (Khôi phục dữ liệu mẫu)',
    category: 'workspace',
    shortMeaning:
      'Đưa toàn bộ dữ liệu MiniShop (tài khoản, số dư, đơn hàng, đánh giá) về trạng thái ban đầu.',
    analogy: 'Giống như bấm nút dọn lại bàn thí nghiệm sạch sẽ trước khi làm lượt thử nghiệm mới.',
  },
  {
    id: 'sql-injection',
    term: 'SQL Injection (SQLi)',
    category: 'vulnerability',
    shortMeaning:
      'Lỗi nối thẳng dữ liệu người dùng vào câu lệnh SQL, khiến kẻ tấn công thay đổi được ý nghĩa truy vấn.',
    analogy:
      'Giống như điền tên kèm câu lệnh vào mẫu đơn, làm nhân viên thực hiện luôn lệnh đó với kho dữ liệu.',
  },
  {
    id: 'stored-xss',
    term: 'Stored XSS',
    category: 'vulnerability',
    shortMeaning:
      'Mã HTML/JavaScript độc hại được lưu vào database và tự chạy trên trình duyệt của người khác khi xem lại.',
    analogy:
      'Giống như viết dòng chữ có gắn bẫy lên bảng tin chung khiến ai đọc cũng bị kích hoạt.',
  },
  {
    id: 'idor',
    term: 'IDOR (Insecure Direct Object Reference)',
    category: 'vulnerability',
    shortMeaning:
      'Lỗi cho phép xem hoặc sửa dữ liệu của người khác chỉ bằng cách đổi mã định danh (ID) mà không kiểm tra quyền.',
    analogy:
      'Giống như chỉ cần đổi số phòng trên chìa khóa giấy là mở được phòng khách sạn của người khác.',
  },
  {
    id: 'business-logic',
    term: 'Business Logic Flaw (Lỗi logic nghiệp vụ)',
    category: 'vulnerability',
    shortMeaning:
      'Lỗi tin tưởng các con số nghiệp vụ (giá, số lượng, tổng tiền) do trình duyệt gửi lên thay vì tính lại ở server.',
    analogy: 'Giống như để khách tự ghi giá tiền lên hóa đơn rồi thu ngân thu đúng số đó.',
  },
  {
    id: 'mass-assignment',
    term: 'Mass Assignment',
    category: 'vulnerability',
    shortMeaning:
      'Lỗi gán thẳng toàn bộ trường trong request vào đối tượng dữ liệu, giúp kẻ gian sửa cả cột nhạy cảm như role hay balance.',
    analogy: 'Giống như cho khách tự điền thêm ô "Quyền Admin" vào tờ khai đổi email.',
  },
  {
    id: 'path-traversal',
    term: 'Path Traversal (Vượt đường dẫn)',
    category: 'vulnerability',
    shortMeaning:
      'Lợi dụng ký tự "../" trong tên file để thoát khỏi thư mục cho phép và đọc hoặc ghi file nhạy cảm trên server.',
    analogy:
      'Giống như chỉ đường "đi lùi 2 phòng" để vào kho mật thay vì chỉ lấy file trong ngăn tủ được phép.',
  },
  {
    id: 'race-condition',
    term: 'Race Condition (TOCTOU)',
    category: 'vulnerability',
    shortMeaning:
      'Lỗi xảy ra khi nhiều yêu cầu chạy song song chen vào khoảng trễ giữa lúc kiểm tra điều kiện và lúc cập nhật dữ liệu.',
    analogy:
      'Giống như hai người cùng rút sạch tiền một tài khoản tại hai cây ATM trong cùng một tích tắc.',
  },
  {
    id: 'ssrf',
    term: 'SSRF (Server-Side Request Forgery)',
    category: 'vulnerability',
    shortMeaning:
      'Lừa server gửi yêu cầu mạng thay mình tới các địa chỉ nội bộ hoặc dịch vụ riêng tư mà bên ngoài không truy cập được.',
    analogy:
      'Giống như nhờ người bên trong tòa nhà đi chụp ảnh phòng kỹ thuật nội bộ rồi gửi ra ngoài cho bạn.',
  },
  {
    id: 'safety-pattern',
    term: 'Safety Pattern (Mẫu phòng vệ chuẩn)',
    category: 'defense',
    shortMeaning:
      'Cách viết code an toàn chuẩn mực để triệt tiêu tận gốc một loại lỗ hổng thay vì chỉ chặn tạm bợ vài ký tự.',
    analogy: 'Giống như lắp khóa chống trộm đạt chuẩn thay vì chỉ dán giấy cấm mở cửa.',
  },
  {
    id: 'parameterized-query',
    term: 'Parameterized Query ($1, $2)',
    category: 'defense',
    shortMeaning:
      'Tách riêng khung câu lệnh SQL và giá trị người dùng qua tham số ($1, $2) để database không bao giờ hiểu nhầm dữ liệu là lệnh.',
    analogy:
      'Giống như bỏ tên khách vào phong bì niêm phong riêng — dù viết gì bên trong cũng chỉ được đọc như một cái tên.',
  },
  {
    id: 'output-encoding',
    term: 'Output Encoding (Mã hóa đầu ra)',
    category: 'defense',
    shortMeaning:
      'Biến các ký tự đặc biệt như <, > thành dạng chữ hiển thị thuần túy để trình duyệt không thực thi thành thẻ HTML hay script.',
    analogy:
      'Giống như đóng khung câu nói vào dấu ngoặc kép để mọi người đọc hiểu nội dung chứ không làm theo mệnh lệnh.',
  },
  {
    id: 'file-upload-magic-bytes',
    term: 'Magic Bytes & Allowlist',
    category: 'defense',
    shortMeaning:
      'Kiểm tra những byte đầu tiên thực sự của file (magic bytes) và chỉ chấp nhận định dạng/địa chỉ nằm trong danh sách cho phép.',
    analogy:
      'Giống như mở hẳn thùng hàng kiểm tra ruột bên trong và đối chiếu danh sách hàng hợp lệ thay vì tin nhãn dán ngoài.',
  },
];

/**
 * Look up a glossary entry by its stable identifier.
 *
 * @param id - Glossary entry identifier.
 * @returns Matching entry, or undefined if not found.
 */
export function findGlossaryEntry(id: string): GlossaryEntry | undefined {
  return SECURITY_GLOSSARY.find((entry) => entry.id === id);
}

/**
 * Filter glossary entries by Vietnamese/English search text and category.
 *
 * @param query - Free-text search query.
 * @param category - Category filter or 'all'.
 * @returns Filtered list of matching glossary entries.
 */
export function filterGlossary(
  query: string,
  category: GlossaryCategory | 'all',
): readonly GlossaryEntry[] {
  const normalized = query.trim().toLowerCase();
  return SECURITY_GLOSSARY.filter((entry) => {
    if (category !== 'all' && entry.category !== category) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    const haystack =
      `${entry.id} ${entry.term} ${entry.shortMeaning} ${entry.analogy} ${entry.tip ?? ''}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
