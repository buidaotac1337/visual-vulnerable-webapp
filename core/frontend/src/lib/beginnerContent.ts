import type { LabMetadata } from '@/types';

/** Beginner-friendly Vietnamese guide for a single VVWA vulnerability lab. */
export interface LabBeginnerGuide {
  labId: string;
  everydayAnalogy: string;
  whyDangerous: string;
  tryFirstHint: string;
  fixFiles: readonly string[];
  relatedTermIds: readonly string[];
}

/** Curated Vietnamese beginner guides for all 9 core MiniShop labs. */
export const LAB_BEGINNER_GUIDES: Readonly<Record<string, LabBeginnerGuide>> = {
  '01-sql-injection': {
    labId: '01-sql-injection',
    everydayAnalogy:
      'Giống như bạn ghi tên lên phiếu yêu cầu, nhưng thư ký lại đọc luôn dòng chữ bạn viết như một mệnh lệnh mới thay vì chỉ xem đó là cái tên.',
    whyDangerous:
      'Kẻ tấn công có thể vượt qua màn hình đăng nhập mà không cần mật khẩu đúng, hoặc rút toàn bộ email và mật khẩu người dùng từ cơ sở dữ liệu.',
    tryFirstHint:
      'Ở tab Đăng nhập, bấm chip "Bypass Admin Login" rồi bấm Đăng nhập để thấy tài khoản admin mở ra mà không cần mật khẩu.',
    fixFiles: ['labs/01-sql-injection/backend/vulnerable.py'],
    relatedTermIds: ['sql-injection', 'parameterized-query', 'payload'],
  },
  '02-stored-xss': {
    labId: '02-stored-xss',
    everydayAnalogy:
      'Giống như ai đó dán một tờ giấy có gắn bẫy lên bảng tin chung của cửa hàng: bất kỳ khách hàng nào đi ngang qua đọc bảng tin đều bị dính bẫy.',
    whyDangerous:
      'Đoạn mã độc được lưu vào bình luận và tự chạy trong trình duyệt của mọi người xem, có thể đánh cắp phiên đăng nhập hoặc giả mạo thao tác.',
    tryFirstHint:
      'Chọn người dùng bob, sang tab Viết đánh giá, bấm chip "Bob đăng payload onerror" rồi quay lại tab Xem sản phẩm để thấy script chạy.',
    fixFiles: [
      'labs/02-stored-xss/backend/vulnerable.py',
      'labs/02-stored-xss/frontend/vulnerable.tsx',
    ],
    relatedTermIds: ['stored-xss', 'output-encoding', 'session-actor'],
  },
  '03-idor': {
    labId: '03-idor',
    everydayAnalogy:
      'Giống như tủ giữ đồ ở siêu thị chỉ đánh số 1, 2, 3 mà nhân viên không kiểm tra thẻ gửi đồ — bạn chỉ cần đọc số tủ của người khác là mở lấy đồ được.',
    whyDangerous:
      'Người dùng chỉ cần đổi mã đơn hàng trên yêu cầu là xem trộm được địa chỉ giao hàng, lịch sử mua sắm và thông tin riêng tư của khách khác.',
    tryFirstHint:
      'Đóng vai alice, bấm chip "Alice đổi URL sang đơn #2" để thấy alice xem được đơn hàng vốn thuộc về bob.',
    fixFiles: ['labs/03-idor/backend/vulnerable.py'],
    relatedTermIds: ['idor', 'session-actor', 'safety-pattern'],
  },
  '04-business-logic': {
    labId: '04-business-logic',
    everydayAnalogy:
      'Giống như quầy tự thanh toán cho phép khách hàng tự nhập lại giá tiền và số lượng âm lên hóa đơn, rồi thu ngân cứ thế tính tiền theo giấy khách đưa.',
    whyDangerous:
      'Kẻ gian có thể mua sản phẩm giá $120 với giá $1 hoặc nhập số lượng âm để hệ thống tự cộng thêm tiền vào ví tài khoản.',
    tryFirstHint:
      'Bấm chip "Sửa giá tai nghe thành $1" hoặc "Số lượng âm để được cộng tiền", rồi bấm Thanh toán và quan sát số dư.',
    fixFiles: ['labs/04-business-logic/backend/vulnerable.py'],
    relatedTermIds: ['business-logic', 'payload', 'safety-pattern'],
  },
  '05-mass-assignment': {
    labId: '05-mass-assignment',
    everydayAnalogy:
      'Giống như điền đơn đổi email tại quầy, nhưng bạn viết thêm dòng "Chức vụ: Giám đốc" vào lề giấy và máy tính tự động cập nhật luôn cả dòng đó.',
    whyDangerous:
      'Người dùng bình thường có thể gửi thêm trường role hoặc balance trong request để tự nâng quyền thành admin hoặc tự bơm tiền vào ví.',
    tryFirstHint:
      'Đóng vai bob, bấm chip "Bob thêm role: admin" rồi gửi cập nhật hồ sơ để thấy quyền của bob bị đổi thành admin.',
    fixFiles: ['labs/05-mass-assignment/backend/vulnerable.py'],
    relatedTermIds: ['mass-assignment', 'session-actor', 'safety-pattern'],
  },
  '06-path-traversal': {
    labId: '06-path-traversal',
    everydayAnalogy:
      'Giống như bảo nhân viên kho "lấy giúp tôi hồ sơ trong ngăn kéo ../phong-ke-toan/ket-sat", và nhân viên cứ thế đi ra khỏi kho hóa đơn để lấy tài liệu mật.',
    whyDangerous:
      'Kẻ tấn công dùng ký tự "../" để thoát khỏi thư mục hóa đơn, đọc trộm file cấu hình chứa mật khẩu, khóa bí mật hoặc file hệ thống trên server.',
    tryFirstHint:
      'Bấm chip "Đọc file cấu hình bí mật" rồi bấm Tải hóa đơn để xem nội dung file secrets.env hiện ra ngay trên màn hình.',
    fixFiles: ['labs/06-path-traversal/backend/vulnerable.py'],
    relatedTermIds: ['path-traversal', 'session-actor', 'safety-pattern'],
  },
  '07-file-upload': {
    labId: '07-file-upload',
    everydayAnalogy:
      'Giống như bảo vệ chỉ nhìn nhãn dán bên ngoài thùng hàng ghi "Trái cây" mà không mở thùng kiểm tra xem bên trong có phải bom hay hàng cấm không.',
    whyDangerous:
      'Kẻ tấn công có thể giả mạo nhãn image/png để tải lên mã thực thi, file SVG chứa XSS, hoặc dùng tên file "../index.html" để ghi đè trang chủ.',
    tryFirstHint:
      'Chọn actor admin, bấm chip "Giả mạo MIME (shell.py)" rồi bấm Tải ảnh lên để thấy file Python vẫn được lưu như ảnh hợp lệ.',
    fixFiles: ['labs/07-file-upload/backend/vulnerable.py'],
    relatedTermIds: ['file-upload-magic-bytes', 'path-traversal', 'stored-xss'],
  },
  '08-race-condition': {
    labId: '08-race-condition',
    everydayAnalogy:
      'Giống như 5 người cùng lúc đưa 1 phiếu giảm giá cho 5 thu ngân khác nhau trước khi hệ thống kịp gạch bỏ phiếu đó — cả 5 lần đều được giảm giá.',
    whyDangerous:
      'Khi nhiều request gửi song song cùng lúc, mã giảm giá giới hạn 1 lượt có thể bị áp dụng lặp lại nhiều lần và cộng thưởng vượt mức.',
    tryFirstHint:
      'Bấm chip "Bắn đồng thời 5 request WELCOME10" rồi gửi để thấy số lượt dùng vượt quá giới hạn 1 lần.',
    fixFiles: ['labs/08-race-condition/backend/vulnerable.py'],
    relatedTermIds: ['race-condition', 'sandbox-reset', 'trace'],
  },
  '09-ssrf': {
    labId: '09-ssrf',
    everydayAnalogy:
      'Giống như bạn nhờ lễ tân tòa nhà đi lấy giúp một bức ảnh theo địa chỉ bạn đưa, nhưng bạn lại ghi địa chỉ phòng máy chủ nội bộ mà người ngoài không vào được.',
    whyDangerous:
      'Server bị lợi dụng làm cầu nối để đọc dữ liệu nhạy cảm nội bộ (như khóa IAM, cấu hình database) hoặc dò các dịch vụ chạy trên mạng riêng.',
    tryFirstHint:
      'Chọn actor admin, bấm chip "Đọc IAM Metadata nội bộ" rồi bấm Tải ảnh để xem server lấy hộ dữ liệu mật nội bộ.',
    fixFiles: ['labs/09-ssrf/backend/vulnerable.py'],
    relatedTermIds: ['ssrf', 'file-upload-magic-bytes', 'safety-pattern'],
  },
};

/**
 * Return the beginner guide for a lab, falling back cleanly for any custom lab not in the map.
 *
 * @param lab - Lab metadata loaded from the backend.
 * @returns Beginner guide tailored to the lab or a safe default fallback.
 */
export function getLabBeginnerGuide(lab: LabMetadata): LabBeginnerGuide {
  const existing = LAB_BEGINNER_GUIDES[lab.id];
  if (existing) {
    return existing;
  }
  return {
    labId: lab.id,
    everydayAnalogy: lab.summary,
    whyDangerous: lab.safetyPattern || 'Lỗ hổng có thể khiến dữ liệu hoặc quyền hạn bị lạm dụng.',
    tryFirstHint: 'Chọn một Payload mẫu ở phía trên và bấm thực thi để quan sát Trace từng bước.',
    fixFiles: [`labs/${lab.id}/backend/vulnerable.py`],
    relatedTermIds: ['vulnerable-secure', 'payload', 'safety-pattern'],
  };
}
